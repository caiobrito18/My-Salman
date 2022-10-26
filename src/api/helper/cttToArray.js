module.exports = function contactToArray(number, isGroup) {
  let localArr = [];
  if (Array.isArray(number)) {
    for (let contact of number) {
      contact = contact.split('@')[0];
      if (contact !== '')
        if (isGroup) localArr.push(`${contact}@g.us`);
        else localArr.push(`${contact}@c.us`);
    }
  } else {
    let arrContacts = number.split(/\s*[,;]\s*/g);
    for (let contact of arrContacts) {
      contact = contact.split('@')[0];
      if (contact !== '')
        if (isGroup) localArr.push(`${contact}@g.us`);
        else localArr.push(`${contact}@c.us`);
    }
  }

  return localArr;
}