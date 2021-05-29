const router = require('express').Router();
const mongoose = require('../../database');
const pagarme = require('../../services/pagarme');
const util = require('../../util');
const keys = require('../../data/keys.json');

const _ = require('lodash');
const moment = require('moment');

const Agendamento = require('../models/agendamento');
const Cliente = require('../models/cliente');
const Colaborador = require('../models/colaborador');
const Horario = require('../models/horario');
const Servico = require('../models/servico');
const Salao = require('../models/salao');

router.post('/conta', async (req, res) => {
  const db = mongoose.connection;
  const session = await db.startSession();
  session.startTransaction();
  try {
    const { clienteId, salaoId, colaboradorId, servicoId } = req.body;

    // Recuperar Cliente
    const cliente = await Cliente.findById(clienteId).select(
      'nome endereco customerId'
    );

    // Recuperar Salão
    const salao = await Salao.findById(salaoId).select('recepientId');

    // Recuperar Serviço
    const servico = await Servico.findById(servicoId).select(
      'preco titulo comissao'
    );

    // Recuperar Colaborador
    const colaborador = await Colaborador.findById(colaboradorId).select(
      'recepientId'
    );

    // Criando Pagamento
    const precoFinal = util.toCents(servico.preco);
    const colaboradorSplitRule = {
      recipient_id: colaborador.recipientId,
      amount: parseInt(precoFinal * (servico.comissao / 100)),
    };

    const createPayment = await pagarme('/transactions', {
      // Preco total
      amount: precoFinal,

      // Dados do Cartão
      card_number: '4111111111111111',
      card_cvv: '123',
      card_expiration_date: '0922',
      card_holder_name: 'Morpheus Fishburne',

      // Dados do Cliente
      customer: {
        id: cliente.customerId,
      },
      billing: {
        name: cliente.nome,
        address: {
          country: cliente.endereco.pais,
          state: cliente.endereco.uf,
          city: cliente.endereco.cidade,
          street: cliente.endereco.logradouro,
          street_number: cliente.endereco.numero,
          zipcode: cliente.endereco.cep,
        },
      },

      // Itens da venda
      items: [
        {
          id: servico.id,
          title: servico.titulo,
          unit_price: precoFinal,
          quantity: 1,
          tangible: false,
        },
      ],
      split_rules: [
        // taxa salão
        {
          recipient_id: salao.recipientId,
          amount: precoFinal - keys.app_fee - colaboradorSplitRule.amount,
        },
        // taxa colaborador
        colaboradorSplitRule,
        // taxa app
        {
          recipient_id: keys.recipient_id,
          amount: keys.app_fee,
          charge_processing_fee: false,
        },
      ],
    });

    if (createPayment.error) {
      throw createPayment;
    }

    // Criar agendamento
    const agendamento = await new Agendamento({
      ...req.body,
      transactionId: createPayment.data.id,
      comissao: servico.comissao,
      valor: servico.preco,
    }).save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ error: false, agendamento });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).send({ error: true, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { servicoId } = req.body;

    const servico = await Servico.findById(servicoId).select(
      'preco titulo comissao'
    );

    // Criar agendamento
    const agendamento = await new Agendamento({
      ...req.body,
      comissao: servico.comissao,
      valor: servico.preco,
    }).save();
    return res.json({ error: false, agendamento });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.post('/filter', async (req, res) => {
  try {
    const { periodo, salaoId } = req.body;

    const agendamentos = await Agendamento.find({
      salaoId,
      data: {
        $gte: moment(periodo.inicio).startOf('day'),
        $lte: moment(periodo.final).endOf('day'),
      },
    }).populate([
      { path: 'servicoId', select: 'titulo duracao' },
      { path: 'clienteId', select: 'nome' },
      { path: 'colaboradorId', select: 'nome' },
    ]);

    return res.json({ error: false, agendamentos });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.post('/dias-disponiveis', async (req, res) => {
  try {
    const { data, salaoId, servicoId } = req.body;

    const horarios = await Horario.find({ salaoId });
    const servico = await Servico.findById(servicoId).select('duracao');
    let colaboradores = [];

    let agenda = [];
    let lastDay = moment(data);

    // DURAÇÃO DO SERVIÇO
    const servicoDuracao = util.hourToMinutes(
      moment(servico.duracao).format('HH:mm')
    );
    const servicoDuracaoSlots = util.sliceMinutes(
      moment(servico.duracao),
      moment(servico.duracao).add(servicoDuracao, 'minutes'),
      util.SLOT_DURATION,
      false
    ).length;

    for (let i = 0; i <= 365 && agenda.length <= 7; i++) {
      const espacosValidos = horarios.filter((h) => {
        // VERIFICAR DIA DA SEMANA
        const diaSemanaDisponivel = h.dias.includes(moment(lastDay).day());

        // VERIFICAR ESPECIALIDADE DISPONÍVEL
        const servicosDisponiveis = h.especialidades.includes(servicoId);

        return diaSemanaDisponivel && servicosDisponiveis;
      });

      if (espacosValidos.length > 0) {
        // TODOS OS HORÁRIOS DISPONÍVEIS DAQUELE DIA
        let todosHorariosDia = {};
        for (let espaco of espacosValidos) {
          for (let colaborador of espaco.colaboradores) {
            if (!todosHorariosDia[colaborador._id]) {
              todosHorariosDia[colaborador._id] = [];
            }
            todosHorariosDia[colaborador._id] = [
              ...todosHorariosDia[colaborador._id],
              ...util.sliceMinutes(
                util.mergeDateTime(lastDay, espaco.inicio),
                util.mergeDateTime(lastDay, espaco.fim),
                util.SLOT_DURATION
              ),
            ];
          }
        }

        // SE TODOS OS ESPECIALISTAS DISPONÍVEIS ESTIVEREM OCUPADOS NO HORÁRIO, REMOVER
        for (let colaboradorKey of Object.keys(todosHorariosDia)) {
          // LER AGENDAMENTOS DAQUELE ESPECIALISTA NAQUELE DIA
          const agendamentos = await Agendamento.find({
            colaboradorId: colaboradorKey,
            data: {
              $gte: moment(lastDay).startOf('day'),
              $lte: moment(lastDay).endOf('day'),
            },
          }).select('data -_id');

          // RECUPERANDO HORÁRIOS OCUPADOS
          let horariosOcupado = agendamentos.map((a) => ({
            inicio: moment(a.data),
            fim: moment(a.data).add(servicoDuracao, 'minutes'),
          }));

          horariosOcupado = horariosOcupado
            .map((h) =>
              util.sliceMinutes(h.inicio, h.fim, util.SLOT_DURATION, false)
            )
            .flat();

          console.log(horariosOcupado);

          // REMOVENDO TODOS OS HORÁRIOS QUE ESTÃO OCUPADOS
          let horariosLivres = util.splitByValue(
            _.uniq(
              todosHorariosDia[colaboradorKey].map((h) => {
                return horariosOcupado.includes(h) ? '-' : h;
              })
            ),
            '-'
          );

          // VERIFICANDO SE NOS HORÁRIOS CONTINUOS EXISTE SPAÇO SUFICIENTE NO SLOT
          horariosLivres = horariosLivres
            .filter((h) => h.length >= servicoDuracaoSlots)
            .flat();

          // SEPARANDO 2 EM 2
          horariosLivres = _.chunk(horariosLivres, 2);

          // REMOVENDO O COLABORADOR DO DIA, CASO NÃO TENHA ESPAÇOS NA AGENDA
          if (horariosLivres.length === 0) {
            todosHorariosDia = _.omit(todosHorariosDia, colaboradorKey);
          } else {
            todosHorariosDia[colaboradorKey] = horariosLivres;
          }
        }

        // VERIFICANDO SE TEM ESPECIALISTA COM AGENDA NAQUELE DIA
        const totalColaboradores = Object.keys(todosHorariosDia).length;

        if (totalColaboradores > 0) {
          colaboradores.push(Object.keys(todosHorariosDia));
          agenda.push({
            [moment(lastDay).format('YYYY-MM-DD')]: todosHorariosDia,
          });
        }
      }

      lastDay = moment(lastDay).add(1, 'day');
    }

    colaboradores = await Colaborador.find({
      _id: { $in: _.uniq(colaboradores.flat()) },
    }).select('nome foto');

    colaboradores = colaboradores.map((c) => ({
      ...c._doc,
      nome: c.nome.split(' ')[0],
    }));

    return res.json({ error: false, colaboradores, agenda });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

module.exports = (app) => app.use('/agendamento', router);
