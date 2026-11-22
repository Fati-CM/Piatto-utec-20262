import { api } from './api';

export type MenuOption = {
  id: string;
  name: string;
  description: string;
  stock: number;
};

export type Menu = {
  id: string;
  category: string;
  price: number;
  description: string;
  availability: 'Disponible' | 'Pocas porciones' | 'Agotado';
  options: MenuOption[];
};

type ApiMenu = {
  menuId: string;
  category: string;
  priceMinor: number;
  description: string;
  options: {
    id: string;
    dishId: string;
    name: string;
    stock: number;
  }[];
};

type MenusResponse = {
  date: string;
  timezone: string;
  menus: ApiMenu[];
};

export async function getMenus(signal?: AbortSignal): Promise<{
  date: string;
  menus: Menu[];
}> {
  const date = import.meta.env.VITE_MENU_DATE;
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const result = await api<MenusResponse>(`/menus${query}`, { signal });

  const order = ['eco', 'est', 'eje', 'sal'];

  const menus = result.menus.map((menu): Menu => {
    const stock = menu.options.reduce(
      (total, option) => total + option.stock,
      0,
    );

    return {
      id: menu.menuId,
      category: menu.category,
      price: menu.priceMinor / 100,
      description: menu.description,
      availability:
        stock <= 0
          ? 'Agotado'
          : stock <= 5
            ? 'Pocas porciones'
            : 'Disponible',
      options: menu.options.map((option, index) => ({
        id: option.id,
        name:
          menu.menuId === 'est'
            ? `Estudiantil ${index + 1}`
            : option.name,
        description: option.name,
        stock: option.stock,
      })),
    };
  });

  menus.sort((a, b) => {
    const position = (id: string) => {
      const index = order.indexOf(id);
      return index === -1 ? order.length : index;
    };

    return position(a.id) - position(b.id);
  });

  return { date: result.date, menus };
}
