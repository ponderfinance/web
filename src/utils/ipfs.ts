export const getIpfsGateway = (uri: string): string => {
  return uri?.replace('ipfs://', 'https://ipfs.io/ipfs/')
}
