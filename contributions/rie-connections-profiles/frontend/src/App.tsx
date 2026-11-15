import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { navigate, useRoute } from './hooks/useRouter';
import { ToastProvider } from './hooks/useToast';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { CoffeeChatsPage } from './pages/CoffeeChatsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MessagesPage } from './pages/MessagesPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { ProfileDetailPage } from './pages/ProfileDetailPage';

const PUBLIC = new Set(['/login', '/register']);

function Routes() {
  const { user, loading } = useAuth();
  const route = useRoute();
  const isPublic = PUBLIC.has(route.path);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) navigate('/login');
    else if (user && (isPublic || route.path === '/')) navigate('/dashboard');
  }, [user, loading, isPublic, route.path]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loading /></div>;
  if (!user) return route.path === '/register' ? <RegisterPage /> : <LoginPage />;

  const [section, id] = route.segments;
  let page;
  switch (section) {
    case 'discover':
      page = <DiscoverPage />;
      break;
    case 'connections':
      page = <ConnectionsPage />;
      break;
    case 'coffee-chats':
      page = <CoffeeChatsPage />;
      break;
    case 'messages':
      page = <MessagesPage otherId={id ? Number(id) : null} />;
      break;
    case 'me':
      page = <MyProfilePage />;
      break;
    case 'profiles':
      page = <ProfileDetailPage key={id} id={Number(id)} />;
      break;
    default:
      page = <DashboardPage />;
  }
  return <Layout current={`/${section ?? 'dashboard'}`}>{page}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes />
      </ToastProvider>
    </AuthProvider>
  );
}
