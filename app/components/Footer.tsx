export const Footer = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between">
        <div className="flex gap-4 text-sm text-gray-500">
          <a href="https://docs.zora.co/" className="hover:text-gray-900 uppercase">
            DOCS
          </a>
          <a href="#" className="hover:text-gray-900 uppercase">
            GITHUB
          </a>
          <span className="text-gray-400">X</span>
        </div>

        <div className="text-lg text-gray-900">Base Sepolia</div>
      </div>
    </footer>
  )
}
