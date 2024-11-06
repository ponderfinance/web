interface SectionHeaderProps {
  children: React.ReactNode
}

const SectionHeader = ({ children }: SectionHeaderProps) => (
  <h2 className="text-3xl uppercase tracking-wide text-gray-400">{children}</h2>
)

interface ActionButtonProps {
  children: React.ReactNode
  onClick?: () => void
}

const ActionButton = ({ children, onClick }: ActionButtonProps) => (
  <button
    onClick={onClick}
    className="w-full text-2xl rounded border-2 border-black px-8 py-4 text-center hover:border-gray-400 hover:text-gray-400"
  >
    {children}
  </button>
)

interface ButtonGroupProps {
  children: React.ReactNode
}

const ButtonGroup = ({ children }: ButtonGroupProps) => (
  <div className="flex flex-col gap-2">{children}</div>
)

interface SectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

const Section = ({ title, children, className = '' }: SectionProps) => (
  <div className={`flex flex-col gap-4 ${className}`}>
    <SectionHeader>{title}</SectionHeader>
    {children}
  </div>
)

export const Nav = () => {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center gap-4">
        <h1 className="text-7xl">Minting App</h1>
      </div>

      <Section title="Creator Client">
        <ActionButton>Create</ActionButton>
      </Section>

      <Section title="Collector Client" className="mt-8">
        <ButtonGroup>
          <ActionButton>Mint</ActionButton>
          <ActionButton>Buy on Secondary</ActionButton>
          <ActionButton>Sell on Secondary</ActionButton>
        </ButtonGroup>
      </Section>
    </div>
  )
}
