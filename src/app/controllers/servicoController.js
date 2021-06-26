const router = require('express').Router();
const Busboy = require('busboy');
const aws = require('../../services/aws');
const _ = require('lodash');

const Servico = require('../models/servico');
const Arquivo = require('../models/arquivo');
const ColaboradorServico = require('../models/relationship/colaboradorServico');

router.post('/', async (req, res) => {
  let busboy = new Busboy({ headers: req.headers });
  busboy.on('finish', async () => {
    try {
      const { salaoId, servico } = req.body;
      let errors = [];
      let arquivos = [];

      // Upload na AWS
      if (req.files && Object.keys(req.files).length > 0) {
        for (let key of Object.keys(req.files)) {
          const file = req.files[key];

          const nameParts = file.name.split('.');
          const fileName = `${new Date().getTime()}.${
            nameParts[nameParts.length - 1]
          }`;
          const path = `servicos/${salaoId}/${fileName}`;

          const response = await aws.uploadToS3(file, path);

          if (response.error) {
            errors.push({ error: true, message: err.message });
          } else {
            arquivos.push(path);
          }
        }
      }

      if (errors.length > 0) {
        res.json(errors[0]);
        return false;
      }

      // CRIAR SERVIÇO
      let jsonServico = JSON.parse(servico);
      const servicoCadastrado = await new Servico(jsonServico).save();

      // CRIAR ARQUIVO
      arquivos = arquivos.map((arquivo) => ({
        referenciaId: servicoCadastrado._id,
        model: 'Servico',
        arquivo,
      }));
      await Arquivo.insertMany(arquivos);

      res.json({ error: false, servicoCadastrado, arquivos });
    } catch (err) {
      return res.status(400).send({ error: true, message: err.message });
    }
  });
  req.pipe(busboy);
});

router.put('/:servicoId', async (req, res) => {
  let busboy = new Busboy({ headers: req.headers });
  busboy.on('finish', async () => {
    try {
      const { salaoId, servico } = req.body;
      let errors = [];
      let arquivos = [];

      // UPLOAD AWS
      if (req.files && Object.keys(req.files).length > 0) {
        for (let key of Object.keys(req.files)) {
          const file = req.files[key];

          const nameParts = file.name.split('.');
          const fileName = `${new Date().getTime()}.${
            nameParts[nameParts.length - 1]
          }`;
          const path = `servicos/${salaoId}/${fileName}`;

          const response = await aws.uploadToS3(file, path);

          if (response.error) {
            errors.push({ error: true, message: err.message });
          } else {
            arquivos.push(path);
          }
        }
      }

      if (errors.length > 0) {
        res.json(errors[0]);
        return false;
      }

      // ATUALIZAR SERVIÇO
      const jsonServico = JSON.parse(servico);
      await Servico.findByIdAndUpdate(req.params.servicoId, jsonServico);

      // CRIAR ARQUIVO
      arquivos = arquivos.map((arquivo) => ({
        referenciaId: req.params.servicoId,
        model: 'Servico',
        arquivo,
      }));
      await Arquivo.insertMany(arquivos);

      return res.json({ error: false });
    } catch (err) {
      return res.status(400).send({ error: true, message: err.message });
    }
  });
  req.pipe(busboy);
});

router.post('/remove-arquivo', async (req, res) => {
  try {
    const { arquivo } = req.body;

    // EXCLUIR AWS
    await aws.deleteFileS3(arquivo);

    await Arquivo.findOneAndDelete({ arquivo });

    return res.json({ error: false });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.delete('/:servicoId', async (req, res) => {
  try {
    const { servicoId } = req.params;

    await Servico.findByIdAndUpdate(servicoId, { status: 'E' });

    return res.json({ error: false });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});

router.get('/salao/:salaoId', async (req, res) => {
  try {
    const { salaoId } = req.params;
    let servicosSalao = [];

    const servicos = await Servico.find({
      salaoId,
      status: { $ne: 'E' },
    });

    for (let servico of servicos) {
      const arquivos = await Arquivo.find({
        model: 'Servico',
        referenciaId: servico._id,
      });
      servicosSalao.push({ ...servico._doc, arquivos });
    }

    return res.json({ servicos: servicosSalao });
  } catch (err) {
    return res.status(400).send({ error: true, message: err.message });
  }
});


module.exports = (app) => app.use('/servico', router);
