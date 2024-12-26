import { useState } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { usePonderSDK } from '@ponderfinance/sdk'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const launchSchema = z.object({
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(8),
  imageURI: z.string().url(),
})

type FormValues = z.infer<typeof launchSchema>

export default function LaunchCreationForm() {
  const sdk = usePonderSDK()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [launchId, setLaunchId] = useState<string>('')

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<FormValues>()

  const onSubmit = async (data: FormValues) => {
    if (!sdk) return

    try {
      const validatedData = launchSchema.parse(data)

      setIsLoading(true)
      setError('')

      const tx = await sdk.launcher.createLaunch({
        name: validatedData.name,
        symbol: validatedData.symbol,
        imageURI: validatedData.imageURI,
      })

      // const result = await tx.wait()
      // setLaunchId(result.launchId.toString())
      reset()
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError('Invalid input format')
      } else {
        setError(err.message || 'Failed to create launch')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <View gap={16}>
          <View gap={8}>
            <Text variant="title-3">Create Token Launch</Text>

            {error && <Text>{error}</Text>}
            {launchId && (
              <Text color="positive">Launch created successfully! ID: {launchId}</Text>
            )}

            <View gap={4}>
              <Text>Token Name</Text>
              <input
                type="text"
                placeholder="My Token"
                {...register('name')}
                className="w-full p-2 border rounded"
              />
              {errors.name && <Text>Invalid token name</Text>}
            </View>

            <View gap={4}>
              <Text>Token Symbol</Text>
              <input
                type="text"
                placeholder="TKN"
                {...register('symbol')}
                className="w-full p-2 border rounded"
              />
              {errors.symbol && <Text>Invalid token symbol</Text>}
            </View>

            <View gap={4}>
              <Text>Token Image URI</Text>
              <input
                type="text"
                placeholder="ipfs://..."
                {...register('imageURI')}
                className="w-full p-2 border rounded"
              />
              {errors.imageURI && <Text>Invalid image URI</Text>}
            </View>
          </View>

          <Button type="submit" disabled={isLoading} loading={isLoading} fullWidth>
            Create Launch
          </Button>
        </View>
      </form>
    </Card>
  )
}
