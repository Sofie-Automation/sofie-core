// Jest cannot load a stylesheet, and a component only imports its own for the side effect, so every stylesheet is
// mapped to this empty module (see moduleNameMapper in jest.config.cjs)
export default {}
