/** Returns a copy of a User/Firm/Admin record with passwordHash removed. */
function publicAccount(record) {
  if (!record) return record;
  const { passwordHash, ...safe } = record;
  return safe;
}

module.exports = { publicAccount };
