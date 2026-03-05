import { Music2 } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Music2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">SongRec</span>
        </div>
        <span className="text-sm text-muted-foreground">Open-source Shazam client</span>
      </div>
    </header>
  )
}
