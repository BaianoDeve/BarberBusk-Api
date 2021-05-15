const mongoose = require('../../database');
const Schema = mongoose.Schema;

const cliente = new Schema({
  nome: {
    type: String,
    require: [true, 'Nome é Obrigatorio'],
  },
  telefone: {
    type: String,
    require: true,
  },
  email: {
    type: String,
    require: [true, 'E-mail é Obrigatorio'],
  },
  senha: {
    type: String,
    default: null,
  },
  foto: {
    type: String,
    require: true,
  },
  dataNascimento: {
    type: String,
    require: true,
  },
  sexo: {
    type: String,
    enum: ['M', 'F'],
    require: true,
  },
  status: {
    type: String,
    enum: ['A', 'I'],
    default: 'A',
  },
  documento: {
    tipo: {
      type: String,
      enum: ['cpf', 'cnpj'],
    },
    numero: {
      type: String,
    },
  },
  endereco: {
    cidade: String,
    uf: String,
    cep: String,
    numero: String,
    pais: String,
  },
  customerId: {
    type: String,
  },
  dataCadastro: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Cliente', cliente);
