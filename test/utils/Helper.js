class Helper {
  // WAITING FUNCTION AS PER THE TIME GIVEN
  async wait(ms) {
    const start = Date.now();
    let now = start;
    while (now - start < ms) {
      now = Date.now();
    }
  }
}

export default new Helper();
