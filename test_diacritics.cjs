const removeDiacritics = (str) => {
  if (!str) return str;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};
console.log(removeDiacritics("DRA opacă LEKA 140x300 gri"));
console.log(removeDiacritics("țșăîâȚȘĂÎÂ"));
