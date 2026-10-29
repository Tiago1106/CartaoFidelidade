import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

export const routes = [{ path: '/', element: <HomePage /> }];

export const router = createBrowserRouter(routes);
