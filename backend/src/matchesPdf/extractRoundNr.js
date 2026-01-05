function extractMatchRound(text) {
    const roundRegex = /Round\s+(\d+)/i;
    const match = text.match(roundRegex);
    return match ? parseInt(match[1], 10) : null;
}

export { extractMatchRound };