const mongoose = require('../../database');
const Schema = mongoose.Schema;

const arquivo = new Schema({
  referenciaId: {
    type: Schema.Types.ObjectId,
    refPath: 'model',
  },
  model: {
    type: String,
    required: true,
    enum: ['Servico', 'Salao'],
  },
  arquivo: {
    type: String,
    required: true,
  },
  dataCadastro: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

module.exports = mongoose.model('Arquivo', arquivo);
