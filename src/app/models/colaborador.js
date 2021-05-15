const mongoose = require('../../database');
const Schema = mongoose.Schema;

const colaborador = new Schema({
  nome: {
    type: String,
    required: [true, 'Nome é Obrigatorio'],
  },
  telefone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: [true, 'E-mail é Obrigatorio'],
  },
  senha: {
    type: String,
    default: null,
  },
  foto: {
    type: String,
    required: true,
  },
  dataNascimento: {
    type: String,
    required: true,
  },
  sexo: {
    type: String,
    enum: ['M', 'F'],
    required: true,
  },
  status: {
    type: String,
    enum: ['A', 'I'],
    default: 'A',
  },
  contaBancaria: {
    titular: {
      type: String,
    },
    cpfCnpj: {
      type: String,
    },
    banco: {
      type: String,
    },
    tipo: {
      type: String,
    },
    agencia: {
      type: String,
    },
    numero: {
      type: String,
    },
    dv: {
      type: String,
    },
  },
  recipientId: {
    type: String,
  },
  dataCadastro: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Colaborador', colaborador);
