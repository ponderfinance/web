export const getIpfsGateway = (uri: string): string => {
  return uri?.replace('ipfs://', 'https://ponder-finance.mypinata.cloud/')
}
