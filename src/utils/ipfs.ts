export const getIpfsGateway = (uri: string): string => {
  return uri?.replace('ipfs://', 'https://ponder-finance.mypinata.cloud/ipfs/') + '?pinataGatewayToken=0jL5Qyjh-XEoTm-JHEX3Ye_IXh8eNUJA5X5CO9G98PSLYiE_-3KaxZXjR5rySbIz'
}
