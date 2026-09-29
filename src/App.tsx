import { Calculator } from './components/Calculator'
import { WebBackground } from './components/WebBackground'
import { Tilt3D } from './components/Tilt3D'

function App() {
  return (
    <main className="app-shell" aria-label="Calculator workspace">
      <WebBackground />
      <Tilt3D><Calculator /></Tilt3D>
    </main>
  )
}
export default App
