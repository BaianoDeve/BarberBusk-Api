const mongoose = require('../../database');
const Schema = mongoose.Schema;

const salao = new Schema({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatorio'],
  },
  foto: {
    type: String,
  },
  capa: {
    type: String,
  },
  email: {
    type: String,
    required: [true, 'E-mail é obrigatorio'],
  },
  senha: {
    type: String,
    default: null,
  },
  telefone: {
    type: String,
  },
  endereco: {
    cidade: String,
    uf: String,
    cep: String,
    numero: String,
    pais: String,
  },
  geo: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  dataCadastro: {
    type: Date,
    default: Date.now,
  },
});

salao.index({ geo: '2dsphere' });

module.exports = mongoose.model('Salao', salao);
