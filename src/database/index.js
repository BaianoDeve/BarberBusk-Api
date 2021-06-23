const mongoose = require('mongoose');
const URI = process.env.MONGO_URI;

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

mongoose
  .connect(URI)
  .then(() => console.log('DB is up!'))
  .catch((err) => console.log(err));

module.exports = mongoose;
