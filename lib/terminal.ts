export const getTerminalWidth = (): number => {
  const columns = process.stdout.columns;
  if (columns === undefined) {
    return 80;
  }
  return Math.min(columns, 80);
};
