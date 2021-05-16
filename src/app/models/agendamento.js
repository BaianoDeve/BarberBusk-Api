const mongoose = require('../../database');
const Schema = mongoose.Schema;

const agendamento = new Schema({
  salaoId: {
    type: mongoose.Types.ObjectId,
    ref: 'Salao',
    required: true,
  },
  clienteId: {
    type: mongoose.Types.ObjectId,
    ref: 'Cliente',
    required: true,
  },
  servicoId: {
    type: mongoose.Types.ObjectId,
    ref: 'Servico',
    required: true,
  },
  colaboradorId: {
    type: mongoose.Types.ObjectId,
    ref: 'Colaboardor',
    required: true,
  },
  data: {
    type: Date,
    required: true,
  },
  comisao: {
    type: Number,
    required: true,
  },
  valor: {
    type: Number,
    required: true,
  },
  transactionId: {
    type: String,
  },
  dataCadastro: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Agendamento', agendamento);
