export const apiResponse = (
  success: boolean,
  message: string,
  data?: unknown
) => {
  return {
    success,
    message,
    data,
  };
};
