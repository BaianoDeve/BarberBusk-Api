const router = require('express').Router();
const mongoose = require('../../database');
const pagarme = require('../../services/pagarme');
const util = require('../../util');
const keys = require('../../data/keys.json');

const Agendamento = require('../models/agendamento');
const Cliente = require('../models/cliente');
const Colaborador = require('../models/colaborador');
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
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

module.exports = (app) => app.use('/agendamento', router);
