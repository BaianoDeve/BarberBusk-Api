const router = require('express').Router();
const mongoose = require('../../database');
const pagarme = require('../../services/pagarme');

const Cliente = require('../models/cliente');
const SalaoCliente = require('../models/relationship/salaoCliente');

router.post('/', async (req, res) => {
  try {
    const { cliente, salaoId } = req.body;
    let newCliente = null;

    const existentCliente = await Cliente.findOne({
      $or: [{ email: cliente.email }, { telefone: cliente.telefone }],
    });

    // Verificar se Cliente existe
    if (!existentCliente) {
      // Criando Cliente
      newCliente = await new Cliente({ ...cliente }).save();
    }

    // Relacionamento
    const clienteId = existentCliente ? existentCliente._id : newCliente._id;

    // Verifica se já existe relacionamento com o salão
    const existentRelationship = await SalaoCliente.findOne({
      salaoId,
      clienteId,
      status: { $ne: 'E' },
    });

    // Senão estiver vinculado
    if (!existentRelationship) {
      await new SalaoCliente({
        salaoId,
        clienteId,
        status: 'A',
      }).save();
    }

    // Se já existir vinculo entre cliente e salao
    if (existentCliente) {
      await SalaoCliente.findOneAndUpdate(
        {
          salaoId,
          clienteId,
        },
        { status: cliente.vinculo }
      );
    }

    if (existentCliente && existentRelationship) {
      res.json({ error: true, message: 'Cliente já cadastrado!' });
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
    const { cliente, salaoId } = req.body;
    let newCliente = null;

    const existentCliente = await Cliente.findOne({
      $or: [{ email: cliente.email }, { telefone: cliente.telefone }],
    });

    // Verificar se Cliente existe
    if (!existentCliente) {
      const _id = mongoose.Types.ObjectId();

      // Criar Customer
      const pagarmeCustomer = await pagarme('/customers', {
        external_id: _id,
        name: cliente.nome,
        type: cliente.documento.tipo === 'cpf' ? 'individual' : 'corporation',
        country: cliente.endereco.pais,
        email: cliente.email,
        documents: [
          {
            type: cliente.documento.tipo,
            number: cliente.documento.numero,
          },
        ],
        phone_numbers: [cliente.telefone],
        birthday: cliente.dataNascimento,
      });

      if (pagarmeCustomer.error) {
        throw pagarmeCustomer;
      }

      // Criando Cliente
      newCliente = await new Cliente({
        ...cliente,
        _id,
        customerId: pagarmeCustomer.data.id,
      }).save({ session });
    }

    // Relacionamento
    const clienteId = existentCliente ? existentCliente._id : newCliente._id;

    // Verifica se já existe relacionamento com o salão
    const existentRelationship = await SalaoCliente.findOne({
      salaoId,
      clienteId,
      status: { $ne: 'E' },
    });

    // Senão estiver vinculado
    if (!existentRelationship) {
      await new SalaoCliente({
        salaoId,
        clienteId,
        status: cliente.vinculo,
      }).save({ session });
    }

    // Se já existir vinculo entre cliente e salao
    if (existentCliente) {
      await SalaoCliente.findOneAndUpdate(
        {
          salaoId,
          clienteId,
        },
        { status: 'A' },
        { session }
      );
    }

    if (existentCliente && existentRelationship) {
      res.json({ error: true, message: 'Cliente já cadastrado!' });
    } else {
      res.json({ error: false });
    }

    await session.commitTransaction();
    session.endSession();

    if (existentCliente && existentRelationship) {
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

router.post('/filter', async (req, res) => {
  try {
    const clientes = await Cliente.find(req.body.filters);

    res.json({ error: false, clientes });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.get('/salao/:salaoId', async (req, res) => {
  try {
    const { salaoId } = req.params;

    // Recuperar vinculos
    const clientes = await SalaoCliente.find({
      salaoId,
      status: { $ne: 'E' },
    })
      .populate({ path: 'clienteId', select: '-senha -documento' })
      .select('clienteId dataCadastro');

    res.json({
      error: false,
      clientes: clientes.map((vinculo) => ({
        ...vinculo.clienteId._doc,
        vinculoId: vinculo._id,
        dataCadastro: vinculo.dataCadastro,
      })),
    });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.delete('/vinculo/:id', async (req, res) => {
  try {
    await SalaoCliente.findByIdAndUpdate(req.params.id, { status: 'E' });

    return res.json({ error: false });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

module.exports = (app) => app.use('/cliente', router);
