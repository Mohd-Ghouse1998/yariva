export function canonicalUserPair(
  leftUserId: string,
  rightUserId: string,
): {
  userLowId: string;
  userHighId: string;
} {
  return leftUserId < rightUserId
    ? {
        userLowId: leftUserId,
        userHighId: rightUserId,
      }
    : {
        userLowId: rightUserId,
        userHighId: leftUserId,
      };
}
