# Next.js Dashboard Application

Полнофункциональное dashboard-приложение, демонстрирующее современные паттерны и возможности Next.js 15 с использованием App Router.

## Описание проекта

Это приложение для управления инвойсами и клиентами с полной аутентификацией, включающее в себя систему поиска, пагинации и CRUD-операции. 
## Технологический стек

### Core

- **Next.js 15** (latest) - React framework с App Router
- **React 19** (latest) - UI библиотека
- **TypeScript 5.7.3** - Статическая типизация
- **Turbopack** - Новый сверхбыстрый бандлер от Vercel

### Стилизация

- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **@tailwindcss/forms** - Плагин для стилизации форм
- **PostCSS** - Обработка CSS
- **@heroicons/react** - SVG иконки

### База данных и аутентификация

- **PostgreSQL** (через библиотеку `postgres`) - Основная БД
- **NextAuth.js v5 (beta)** - Полноценная система аутентификации
- **bcrypt** - Хеширование паролей

### Валидация и утилиты

- **Zod** - Schema validation для форм и данных
- **clsx** - Условная компиляция CSS классов
- **use-debounce** - Debouncing для поиска

## Архитектурные паттерны и подходы

### 1. App Router Architecture

Проект использует новую файловую систему маршрутизации Next.js:

```
app/
├── layout.tsx                 # Root layout с глобальными стилями
├── page.tsx                   # Landing page
├── login/
│   └── page.tsx              # Страница логина
└── dashboard/
    ├── layout.tsx            # Nested layout для dashboard
    ├── (overview)/           # Route group (без влияния на URL)
    │   ├── page.tsx
    │   └── loading.tsx       # Streaming UI
    ├── invoices/
    │   ├── page.tsx
    │   ├── error.tsx         # Error boundary
    │   ├── create/
    │   │   └── page.tsx
    │   └── [id]/
    │       └── edit/
    │           ├── page.tsx
    │           └── not-found.tsx
    └── customers/
        └── page.tsx
```

**Ключевые концепции:**
- **Route Groups** `(overview)` - группировка без изменения URL
- **Dynamic Routes** `[id]` - динамические параметры
- **Nested Layouts** - переиспользуемые layout компоненты
- **Special Files** - `loading.tsx`, `error.tsx`, `not-found.tsx`

### 2. Server Components & Server Actions

Приложение максимально использует Server Components для оптимизации производительности:

```typescript
// app/lib/actions.ts
'use server';

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });

    // Валидация, DB операции
    await sql`INSERT INTO invoices ...`;

    // Cache revalidation
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}
```

**Преимущества Server Actions:**
- Нет необходимости в отдельном API слое
- Автоматическая безопасность (CSRF protection)
- Прогрессивное улучшение (работает без JavaScript)
- Оптимистичные обновления

### 3. Streaming и Progressive Rendering

Использование React Suspense для загрузки данных:

```typescript
// app/dashboard/invoices/page.tsx
<Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
    <Table query={query} currentPage={currentPage} />
</Suspense>
```

**Паттерн:**
- Instant page load
- Streaming SSR
- Skeleton UI для лучшего UX
- Параллельная загрузка независимых компонентов

### 4. URL State Management

Состояние поиска и пагинации хранится в URL параметрах:

```typescript
// app/ui/search.tsx
const handleSearch = useDebouncedCallback((term) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');

    if (term) {
        params.set('query', term);
    } else {
        params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
}, 300);
```

**Преимущества:**
- Shareable URLs
- Browser history работает корректно
- Server-side rendering дружественность
- Debouncing для оптимизации

### 5. Аутентификация с NextAuth.js

Двухфайловая конфигурация для edge-совместимости:

```typescript
// auth.config.ts - Edge-safe конфигурация
export const authConfig = {
    pages: { signIn: '/login' },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');

            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false;
            }
            // ...
        }
    }
};

// auth.ts - Полная конфигурация с providers
export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                // Валидация с Zod
                // Проверка пароля с bcrypt
            }
        })
    ]
});
```

**Защита маршрутов:**
- Middleware на edge runtime
- Route-level защита
- Callback-based авторизация

### 6. Валидация данных с Zod

Типобезопасная валидация форм:

```typescript
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({ invalid_type_error: 'Выберите покупателя.' }),
    amount: z.coerce.number().gt(0, { message: 'Введите значение больше, чем $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Выберите статус инвойса.'
    }),
    date: z.string()
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
```

**Паттерн:**
- Схемы с кастомными сообщениями ошибок
- `.safeParse()` для безопасной валидации
- `.omit()` / `.pick()` для переиспользования схем
- Автоматический TypeScript inference

### 7. Обработка ошибок

Многоуровневая система обработки ошибок:

```typescript
// app/dashboard/invoices/error.tsx
'use client';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div>
            <h2>Что-то пошло не так!</h2>
            <button onClick={() => reset()}>Попробовать снова</button>
        </div>
    );
}
```

**Уровни:**
- Error Boundaries (`error.tsx`)
- Not Found страницы (`not-found.tsx`)
- Try-catch в Server Actions
- Database error handling

### 8. Оптимизация производительности

#### Параллельные запросы к БД

```typescript
export async function fetchCardData() {
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    const invoiceStatusPromise = sql`SELECT SUM(...) FROM invoices`;

    // Параллельное выполнение
    const data = await Promise.all([
        invoiceCountPromise,
        customerCountPromise,
        invoiceStatusPromise
    ]);
}
```

#### SQL с защитой от инъекций

```typescript
// Параметризованные запросы через tagged templates
await sql`
    SELECT * FROM invoices
    WHERE
        customers.name ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
`;
```

### 9. Metadata API

SEO-оптимизация через новый Metadata API:

```typescript
// app/layout.tsx
export const metadata: Metadata = {
    title: {
        template: '%s | Дашборд',
        default: 'Дашборд'
    },
    description: 'Дашборд по официальному курсу Next.js от Vercel',
    metadataBase: new URL('https://next-learn-dashboard.vercel.sh')
};

// app/dashboard/invoices/page.tsx
export const metadata: Metadata = {
    title: 'Инвойсы'  // Результат: "Инвойсы | Дашборд"
};
```

### 10. Type Safety

Строгая типизация на всех уровнях:

```typescript
// app/lib/definitions.ts
export type Invoice = {
    id: string;
    customer_id: string;
    amount: number;
    date: string;
    status: 'pending' | 'paid';
};

// SQL queries с generic типами
const data = await sql<Invoice[]>`SELECT * FROM invoices`;
```

## Ключевые функции

- **Аутентификация**: Полноценная система логина с хешированием паролей
- **CRUD операции**: Создание, чтение, обновление и удаление инвойсов
- **Поиск**: Real-time поиск с debouncing по клиентам и инвойсам
- **Пагинация**: Server-side pagination
- **Responsive Design**: Адаптивный UI для всех устройств
- **Error Handling**: Graceful error recovery
- **Loading States**: Skeleton UI для улучшения UX

## Структура проекта

```
nextjs-dashboard/
├── app/
│   ├── lib/
│   │   ├── actions.ts       # Server Actions
│   │   ├── data.ts          # Data fetching functions
│   │   ├── definitions.ts   # TypeScript types
│   │   └── utils.ts         # Utility functions
│   ├── ui/                  # React components
│   └── ...                  # Pages & layouts
├── auth.ts                  # NextAuth configuration
├── auth.config.ts           # Auth middleware config
└── ...
```

## Запуск проекта

### Требования

- Node.js 18+
- pnpm (рекомендуется)
- PostgreSQL база данных

### Установка

```bash
# Установка зависимостей
pnpm install

# Настройка переменных окружения
# Создайте .env файл с:
POSTGRES_URL=your_database_url
AUTH_SECRET=your_secret_key

# Запуск в режиме разработки (с Turbopack)
pnpm dev

# Сборка для продакшена
pnpm build

# Запуск продакшен-версии
pnpm start

# Линтинг
pnpm lint

# Type checking
pnpm typescript:lint
```

## Лучшие практики, использованные в проекте

1. **Server-First подход**: Максимальное использование Server Components
2. **Progressive Enhancement**: Формы работают без JavaScript
3. **Type Safety**: Полная типизация от БД до UI
4. **Security**: Хеширование паролей, защита от SQL-инъекций, CSRF protection
5. **Performance**: Streaming, параллельные запросы, debouncing
6. **UX**: Loading states, error boundaries, optimistic updates
7. **SEO**: Metadata API, server-side rendering
8. **Code Organization**: Четкое разделение concerns (data, actions, UI)

## Лицензия

Проект создан в образовательных целях.
