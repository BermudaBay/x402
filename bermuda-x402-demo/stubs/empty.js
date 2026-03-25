// Empty stub — module not needed for EVM-only Privy usage
module.exports = new Proxy({}, {
  get: () => () => {},
})
