const mongoose = require('mongoose');
const URI =
  'mongodb+srv://salaoUser:0buzbA9gMipmon0F@cluster0.5oiea.mongodb.net/barberbuskDB?retryWrites=true&w=majority';

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

mongoose
  .connect(URI)
  .then(() => console.log('DB is up!'))
  .catch((err) => console.log(err));

module.exports = mongoose;
