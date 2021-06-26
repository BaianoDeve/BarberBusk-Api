const router = require('express').Router();

const Horario = require('../models/horario');

router.post('/', async (req, res) => {
  try {
    const horario = await new Horario(req.body).save();

    return res.json({ horario });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.get('/salao/:salaoId', async (req, res) => {
  try {
    const { salaoId } = req.params;

    const horarios = await Horario.find({ salaoId });

    return res.json({ error: false, horarios });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.put('/:horarioId', async (req, res) => {
  try {
    const { horarioId } = req.params;
    const horario = req.body;

    await Horario.findByIdAndUpdate(horarioId, horario);

    return res.json({ error: false });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.delete('/:horarioId', async (req, res) => {
  try {
    const { horarioId } = req.params;

    await Horario.findByIdAndDelete(horarioId);

    return res.json({ error: false });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});


router.post('/colaboradores', async (req, res) => {
  try {
    const colaboradorServico = await ColaboradorServico.find({
      servicoId: { $in: req.body.especialidades },
      status: 'A',
    })
      .populate('colaboradorId', 'nome')
      .select('colaboradorId -_id');

    const listaColaboradores = _.uniqBy(colaboradorServico, (i) =>
      i.colaboradorId._id.toString()
    ).map((i) => ({
      label: i.colaboradorId.nome,
      value: i.colaboradorId._id,
    }));

    return res.json({ error: false, listaColaboradores });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

module.exports = (app) => app.use('/horario', router);
