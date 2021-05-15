const router = require('express').Router();

const Salao = require('../models/salao');
const Servico = require('../models/servico');

const turf = require('@turf/turf');

router.post('/', async (req, res) => {
  try {
    const salao = await Salao.create(req.body);

    return res.json({ salao });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.get('/servicos/:salaoId', async (req, res) => {
  try {
    const { salaoId } = req.params;
    const servicos = await Servico.find({
      salaoId,
      status: 'A',
    }).select('_id titulo');

    return res.json({
      servicos: servicos.map((s) => ({ label: s.titulo, value: s._id })),
    });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const salao = await Salao.findById(req.params.id).select(
      'capa nome endereco.cidade geo.coordinates telefone'
    );

    const distance = turf
      .distance(
        turf.point(salao.geo.coordinates),
        turf.point([-6.344761, -39.319102])
      )
      .toFixed(2);

    return res.json({ error: false, salao, distance });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

module.exports = (app) => app.use('/salao', router);
