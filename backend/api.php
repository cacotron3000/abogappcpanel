<?php
header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Falta backend/config.php. Copia config.sample.php y completa credenciales.']);
    exit;
}

$config = require $configPath;
if (!is_array($config)) {
    http_response_code(500);
    echo json_encode(['error' => 'config.php inválido.']);
    exit;
}

date_default_timezone_set($config['timezone'] ?? 'UTC');

function jsonInput(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function apiFail(string $message, int $status = 400): void {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

function requireApiKey(array $config): void {
    $expected = $config['api_key'] ?? '';
    $provided = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if (!$expected || !$provided || !hash_equals($expected, $provided)) {
        apiFail('API key inválida.', 401);
    }
}

try {
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $config['db_host'] ?? 'localhost',
        $config['db_name'] ?? ''
    );
    $pdo = new PDO($dsn, $config['db_user'] ?? '', $config['db_pass'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    apiFail('No fue posible conectar a MySQL: ' . $e->getMessage(), 500);
}

requireApiKey($config);

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$payload = jsonInput();

function isValidTableName(string $table): bool {
    return (bool) preg_match('/^[a-zA-Z0-9_]{1,100}$/', $table);
}

function fetchTable(PDO $pdo, string $table, ?string $since = null): array {
    if (!isValidTableName($table)) {
        apiFail('Nombre de tabla inválido.');
    }
    if ($since) {
        $stmt = $pdo->prepare('SELECT payload FROM abogapp_records WHERE table_name = :table AND updated_at > :since ORDER BY app_id ASC');
        $stmt->execute(['table' => $table, 'since' => $since]);
    } else {
        $stmt = $pdo->prepare('SELECT payload FROM abogapp_records WHERE table_name = :table ORDER BY app_id ASC');
        $stmt->execute(['table' => $table]);
    }
    $rows = $stmt->fetchAll();
    $result = [];
    foreach ($rows as $row) {
        $data = json_decode($row['payload'] ?? 'null', true);
        if (is_array($data)) {
            $result[] = $data;
        }
    }
    return $result;
}

function upsertRecords(PDO $pdo, string $table, array $records): array {
    if (!isValidTableName($table)) {
        apiFail('Nombre de tabla inválido.');
    }

    $sql = 'INSERT INTO abogapp_records (table_name, app_id, payload)
            VALUES (:table_name, :app_id, :payload)
            ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP';
    $stmt = $pdo->prepare($sql);

    $saved = 0;
    foreach ($records as $record) {
        if (!is_array($record)) continue;
        $appId = $record['id'] ?? null;
        if ($appId === null || $appId === '') continue;
        $stmt->execute([
            'table_name' => $table,
            'app_id' => (int) $appId,
            'payload' => json_encode($record, JSON_UNESCAPED_UNICODE),
        ]);
        $saved++;
    }

    return ['ok' => true, 'saved' => $saved];
}

switch ($action) {
    case 'pull_table': {
        $table = $_GET['table'] ?? '';
        $since = $_GET['since'] ?? null;
        echo json_encode(['data' => fetchTable($pdo, $table, $since)]);
        break;
    }

    case 'pull_all': {
        $tables = $_GET['tables'] ?? '';
        $since = $_GET['since'] ?? null;
        $list = array_filter(array_map('trim', explode(',', $tables)));
        $data = [];
        foreach ($list as $table) {
            if (!isValidTableName($table)) continue;
            $data[$table] = fetchTable($pdo, $table, $since);
        }
        echo json_encode(['data' => $data]);
        break;
    }

    case 'upsert': {
        $table = $payload['table'] ?? '';
        $records = $payload['records'] ?? [];
        if (!is_array($records)) {
            $records = [$records];
        }
        echo json_encode(upsertRecords($pdo, $table, $records));
        break;
    }

    case 'delete': {
        $table = $payload['table'] ?? '';
        $appId = $payload['id'] ?? null;
        if (!isValidTableName($table) || $appId === null) {
            apiFail('Parámetros inválidos.');
        }
        $stmt = $pdo->prepare('DELETE FROM abogapp_records WHERE table_name = :table AND app_id = :app_id');
        $stmt->execute(['table' => $table, 'app_id' => (int) $appId]);
        echo json_encode(['ok' => true]);
        break;
    }

    case 'login': {
        $email = trim((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        if (!$email || !$password) {
            apiFail('Credenciales incompletas.', 422);
        }
        $stmt = $pdo->prepare('SELECT * FROM abogapp_users WHERE email = :email AND active = 1 LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            apiFail('Credenciales incorrectas.', 401);
        }
        echo json_encode([
            'data' => [
                'user' => [
                    'id' => (string) $user['id'],
                    'email' => $user['email'],
                    'user_metadata' => ['nombre' => $user['nombre']],
                    'is_admin' => (bool) $user['is_admin'],
                ],
                'session' => ['access_token' => bin2hex(random_bytes(24))],
            ],
        ]);
        break;
    }

    case 'users_list': {
        $stmt = $pdo->query('SELECT id, email, nombre, is_admin, active FROM abogapp_users ORDER BY id ASC');
        $users = [];
        foreach ($stmt->fetchAll() as $u) {
            $users[] = [
                'id' => (string) $u['id'],
                'email' => $u['email'],
                'user_metadata' => ['nombre' => $u['nombre']],
                'is_admin' => (bool) $u['is_admin'],
                'active' => (bool) $u['active'],
            ];
        }
        echo json_encode(['data' => ['users' => $users]]);
        break;
    }

    case 'users_get': {
        $id = (int) ($payload['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT id, email, nombre, is_admin, active FROM abogapp_users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $u = $stmt->fetch();
        if (!$u) apiFail('Usuario no encontrado.', 404);
        echo json_encode(['data' => ['user' => [
            'id' => (string) $u['id'],
            'email' => $u['email'],
            'user_metadata' => ['nombre' => $u['nombre']],
            'is_admin' => (bool) $u['is_admin'],
            'active' => (bool) $u['active'],
        ]]]);
        break;
    }

    case 'users_create': {
        $email = trim((string) ($payload['email'] ?? ''));
        $pass = (string) ($payload['password'] ?? '');
        $nombre = trim((string) ($payload['nombre'] ?? ''));
        if (!$email || !$pass || !$nombre) {
            apiFail('Faltan campos para crear usuario.', 422);
        }
        $stmt = $pdo->prepare('INSERT INTO abogapp_users (email, nombre, password_hash, is_admin) VALUES (:email, :nombre, :hash, :is_admin)');
        $stmt->execute([
            'email' => $email,
            'nombre' => $nombre,
            'hash' => password_hash($pass, PASSWORD_DEFAULT),
            'is_admin' => !empty($payload['is_admin']) ? 1 : 0,
        ]);
        echo json_encode(['data' => ['id' => (string) $pdo->lastInsertId()]]);
        break;
    }

    case 'users_update': {
        $id = (int) ($payload['id'] ?? 0);
        if ($id <= 0) apiFail('ID inválido.');

        $fields = [];
        $params = ['id' => $id];

        if (array_key_exists('email', $payload)) {
            $fields[] = 'email = :email';
            $params['email'] = trim((string) $payload['email']);
        }
        if (array_key_exists('nombre', $payload)) {
            $fields[] = 'nombre = :nombre';
            $params['nombre'] = trim((string) $payload['nombre']);
        }
        if (!empty($payload['password'])) {
            $fields[] = 'password_hash = :hash';
            $params['hash'] = password_hash((string) $payload['password'], PASSWORD_DEFAULT);
        }
        if (array_key_exists('is_admin', $payload)) {
            $fields[] = 'is_admin = :is_admin';
            $params['is_admin'] = !empty($payload['is_admin']) ? 1 : 0;
        }
        if (array_key_exists('active', $payload)) {
            $fields[] = 'active = :active';
            $params['active'] = !empty($payload['active']) ? 1 : 0;
        }

        if (!$fields) apiFail('No hay campos para actualizar.');

        $sql = 'UPDATE abogapp_users SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['ok' => true]);
        break;
    }

    case 'users_delete': {
        $id = (int) ($payload['id'] ?? 0);
        if ($id <= 0) apiFail('ID inválido.');
        $stmt = $pdo->prepare('DELETE FROM abogapp_users WHERE id = :id');
        $stmt->execute(['id' => $id]);
        echo json_encode(['ok' => true]);
        break;
    }

    default:
        apiFail('Acción no soportada.', 404);
}
