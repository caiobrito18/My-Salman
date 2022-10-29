module.exports = function normalize(text){
  return text.replace(/(%20)/g, '-');
};