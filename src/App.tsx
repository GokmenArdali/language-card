import { TabBar } from './components/TabBar.tsx'
import { useLocation } from './lib/router.ts'
import { AddPage } from './pages/AddPage.tsx'
import { CardListPage } from './pages/CardListPage.tsx'
import { EditPage } from './pages/EditPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { StudyPage } from './pages/StudyPage.tsx'

export default function App() {
  const { route } = useLocation()

  if (route === 'study') return <StudyPage />

  return (
    <div className="flex h-full flex-col">
      {route === 'home' && <HomePage />}
      {route === 'add' && <AddPage />}
      {route === 'cards' && <CardListPage />}
      {route === 'edit' && <EditPage />}
      {route === 'settings' && <SettingsPage />}
      <TabBar current={route === 'edit' ? 'cards' : route} />
    </div>
  )
}
