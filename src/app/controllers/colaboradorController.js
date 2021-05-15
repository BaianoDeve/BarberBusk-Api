const router = require('express').Router();
const mongoose = require('../../database');
const pagarme = require('../../services/pagarme');

// Models
const Colaborador = require('../models/Colaborador');
const SalaoColaborador = require('../models/relationship/salaoColaborador');
const ColaboradorServico = require('../models/relationship/colaboradorServico');

router.post('/', async (req, res) => {
  try {
    const { colaborador, salaoId } = req.body;
    let newColaborador = null;

    const existentColaborador = await Colaborador.findOne({
      $or: [{ email: colaborador.email }, { telefone: colaborador.telefone }],
    });

    // Verificar se colaborador existe
    if (!existentColaborador) {
      // Criando Colaborador
      newColaborador = await new Colaborador({ ...colaborador }).save();
    }

    // Relacionamento
    const colaboradorId = existentColaborador
      ? existentColaborador._id
      : newColaborador._id;

    // Verifica se já existe relacionamento com o salão
    const existentRelationship = await SalaoColaborador.findOne({
      salaoId,
      colaboradorId,
      status: { $ne: 'E' },
    });

    // Senão estiver vinculado
    if (!existentRelationship) {
      await new SalaoColaborador({
        salaoId,
        colaboradorId,
        status: colaborador.vinculo,
      }).save();
    }

    // Se já existir vinculo entre colaborador e salao
    if (existentColaborador) {
      await SalaoColaborador.findOneAndUpdate(
        {
          salaoId,
          colaboradorId,
        },
        { status: colaborador.vinculo }
      );
    }

    // Relação com as especialidades
    await ColaboradorServico.insertMany(
      colaborador.especialidades.map((servicoId) => ({
        servicoId,
        colaboradorId,
      }))
    );

    if (existentColaborador && existentRelationship) {
      res.json({ error: true, message: 'Colaborador já cadastrado!' });
    } else {
      res.json({ error: false });
    }
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.post('/conta', async (req, res) => {
  const db = mongoose.connection;
  const session = await db.startSession();
  session.startTransaction();

  try {
    const { colaborador, salaoId } = req.body;
    let newColaborador = null;

    const existentColaborador = await Colaborador.findOne({
      $or: [{ email: colaborador.email }, { telefone: colaborador.telefone }],
    });

    // Verificar se colaborador existe
    if (!existentColaborador) {
      const { contaBancaria } = colaborador;

      // Criar Conta
      const pagarmeBankAccount = await pagarme('/bank_accounts', {
        bank_code: contaBancaria.banco,
        document_number: contaBancaria.cpfCnpj,
        agencia: contaBancaria.agencia,
        conta: contaBancaria.numero,
        conta_dv: contaBancaria.dv,
        legal_name: contaBancaria.titular,
      });

      if (pagarmeBankAccount.error) {
        throw pagarmeBankAccount;
      }

      // Criar Recebedor
      const pagarmeRecipient = await pagarme('/recipients', {
        transfer_interval: 'daily',
        transfer_enabled: true,
        bank_account_id: pagarmeBankAccount.data.id,
      });

      if (pagarmeRecipient.error) {
        throw pagarmeRecipient;
      }

      // Criando Colaborador
      newColaborador = await new Colaborador({
        ...colaborador,
        recipientId: pagarmeRecipient.data.id,
      }).save({ session });
    }

    // Relacionamento
    const colaboradorId = existentColaborador
      ? existentColaborador._id
      : newColaborador._id;

    // Verifica se já existe relacionamento com o salão
    const existentRelationship = await SalaoColaborador.findOne({
      salaoId,
      colaboradorId,
      status: { $ne: 'E' },
    });

    // Senão estiver vinculado
    if (!existentRelationship) {
      await new SalaoColaborador({
        salaoId,
        colaboradorId,
        status: colaborador.vinculo,
      }).save({ session });
    }

    // Se já existir vinculo entre colaborador e salao
    if (existentColaborador) {
      await SalaoColaborador.findOneAndUpdate(
        {
          salaoId,
          colaboradorId,
        },
        { status: colaborador.vinculo },
        { session }
      );
    }

    // Relação com as especialidades
    await ColaboradorServico.insertMany(
      colaborador.especialidades.map(
        (servicoId) => ({
          servicoId,
          colaboradorId,
        }),
        { session }
      )
    );

    await session.commitTransaction();
    session.endSession();

    if (existentColaborador && existentRelationship) {
      res.json({ error: true, message: 'Colaborador já cadastrado!' });
    } else {
      res.json({ error: false });
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).send({ error: true, message: err.message });
  }
});

router.put('/:colaboradorId', async (req, res) => {
  try {
    const { vinculo, vinculoId, especialidades } = req.body;
    const { colaboradorId } = req.params;

    // Vinculo
    await SalaoColaborador.findByIdAndUpdate(vinculoId, { status: vinculo });

    // Especialidades
    await ColaboradorServico.deleteMany({ colaboradorId });

    await ColaboradorServico.insertMany(
      especialidades.map((servicoId) => ({
        servicoId,
        colaboradorId,
      }))
    );

    return res.json({ error: false });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.delete('/vinculo/:id', async (req, res) => {
  try {
    await SalaoColaborador.findByIdAndUpdate(req.params.id, { status: 'E' });

    return res.json({ error: false });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.post('/filter', async (req, res) => {
  try {
    const colaboradores = await Colaborador.find(req.body.filters);

    res.json({ error: false, colaboradores });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.get('/salao/:salaoId', async (req, res) => {
  try {
    const { salaoId } = req.params;
    let listaColaboradores = [];

    // Recuperar vinculos
    const colaboradores = await SalaoColaborador.find({
      salaoId,
      status: { $ne: 'E' },
    })
      .populate({ path: 'colaboradorId', select: '-senha -contaBancaria' })
      .select('colaboradorId dataCadastro status');

    for (let vinculo of colaboradores) {
      const especialidades = await ColaboradorServico.find({
        colaboradorId: vinculo.colaboradorId._id,
      });

      listaColaboradores.push({
        ...vinculo._doc,
        especialidades,
      });
    }

    res.json({
      error: false,
      colaboradores: listaColaboradores.map((vinculo) => ({
        ...vinculo.colaboradorId._doc,
        vinculoId: vinculo._id,
        vinculo: vinculo.status,
        especialidades: vinculo.especialidades,
        dataCadastro: vinculo.dataCadastro,
      })),
    });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

module.exports = (app) => app.use('/colaborador', router);
