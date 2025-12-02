/**
 * 404 Not Found Page
 */

import { useNavigate } from 'react-router-dom';

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
        <p className="text-2xl text-gray-600 mb-4">Страница не найдена</p>
        <p className="text-gray-500 mb-8">
          Извините, но запрошенная страница не существует или была удалена
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Вернуться на главную
        </button>
      </div>
    </div>
  );
}

export default NotFoundPage;
