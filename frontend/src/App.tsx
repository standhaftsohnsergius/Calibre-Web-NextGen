import { useMe, useLogout } from './lib/queries';
import { Login } from './pages/Login';
import { Catalog } from './pages/Catalog';
import { TopBar } from './components/TopBar';
import { SpinnerCentered } from './components/Spinner';

export function App() {
  const { data: me, isLoading } = useMe();
  const logout = useLogout();

  if (isLoading) {
    return <SpinnerCentered size={40} />;
  }

  if (!me) {
    return <Login />;
  }

  return (
    <>
      <TopBar
        userName={me.name}
        onLogout={() => logout.mutate()}
      />
      <Catalog />
    </>
  );
}
