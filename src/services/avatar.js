function avatarColorForUser(userId) {
  const hue = (Math.imul(Number(userId), 137) + 29) % 360;
  return `hsl(${hue} 62% 88%)`;
}

module.exports = { avatarColorForUser };
