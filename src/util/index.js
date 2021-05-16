module.exports = {
  toCents: (price) => {
    return parseInt(price.toString().replace('.', '').replace(',', ''));
  },
};
