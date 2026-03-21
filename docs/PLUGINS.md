# NEXUS Command Platform - Plugin Documentation

## Overview

NEXUS Command Platform includes 59 community plugins that extend the platform's functionality. Plugins follow a unified manifest-based architecture with lifecycle hooks, functions, and event subscriptions.

## Plugin Architecture

Each plugin is a JavaScript module with the following structure:

```javascript
export default {
  id: 'plugin-name',
  name: 'Plugin Name',
  version: '1.0.0',
  description: 'Plugin description',
  
  init: async (context) => {},
  activate: async (context) => {},
  deactivate: async () => {},
  
  hooks: {
    'agent:beforeExecute': async (data) => {},
    'message:beforeSend': async (data) => {}
  },
  
  functions: {
    myFunction: async (args) => {}
  }
};
```

## Plugin Categories

### Utilities (10)

#### math-plugin
Mathematical operations including basic arithmetic, trigonometry, and advanced functions.

```javascript
// Usage
nexus.plugin('math').calculate('sqrt(144)');  // Returns 12
nexus.plugin('math').evaluate('2 + 2');        // Returns 4
```

#### calculator-plugin
General-purpose calculator with support for complex expressions.

```javascript
nexus.plugin('calculator').compute('(10 + 5) * 2');  // Returns 30
```

#### date-plugin
Date and time utilities including formatting, parsing, and calculations.

```javascript
nexus.plugin('date').format('YYYY-MM-DD');           // Current date
nexus.plugin('date').addDays(7);                     // 7 days from now
nexus.plugin('date').diff('2024-01-01', '2024-01-15'); // Days difference
```

#### random-plugin
Random number and data generation for testing and games.

```javascript
nexus.plugin('random').number(1, 100);      // Random between 1-100
nexus.plugin('random').string(16);          // Random string
nexus.plugin('random').uuid();              // UUID v4
nexus.plugin('random').choice(['a', 'b']); // Random choice
```

#### array-plugin
Array manipulation utilities for sorting, filtering, and transformation.

```javascript
nexus.plugin('array').chunk([1,2,3,4], 2);      // [[1,2], [3,4]]
nexus.plugin('array').unique([1,2,2,3]);         // [1,2,3]
nexus.plugin('array').flatten([[1,2], [3]]);     // [1,2,3]
```

#### unit-plugin
Unit conversion for length, weight, temperature, and more.

```javascript
nexus.plugin('unit').convert(100, 'km', 'mi');   // Kilometers to miles
nexus.plugin('unit').convert(0, 'c', 'f');       // Celsius to Fahrenheit
nexus.plugin('unit').convert(1, 'kg', 'lb');     // Kilograms to pounds
```

#### compression-plugin
Data compression using gzip, deflate, and brotli.

```javascript
nexus.plugin('compression').compress('data');    // Compress string
nexus.plugin('compression').decompress(data);     // Decompress
nexus.plugin('compression').gzip(data);          // Gzip compression
```

#### geo-plugin
Geolocation utilities for distance, coordinates, and geocoding.

```javascript
nexus.plugin('geo').distance([40.7, -74], [51.5, -0.1]); // Haversine distance
nexus.plugin('geo').withinRadius(point, center, radius);   // Check bounds
```

#### cron-plugin
Cron expression parsing and scheduling.

```javascript
nexus.plugin('cron').parse('0 * * * *');         // Every hour
nexus.plugin('cron').nextRun('0 9 * * *');        // Next run time
nexus.plugin('cron').isValid('*/5 * * * *');     // Validate expression
```

#### stats-plugin
Statistical analysis including mean, median, standard deviation.

```javascript
nexus.plugin('stats').mean([1,2,3,4,5]);          // 3
nexus.plugin('stats').median([1,2,3,4,5]);        // 3
nexus.plugin('stats').stdev([1,2,3,4,5]);         // Standard deviation
```

---

### Text Processing (8)

#### text-plugin
Text processing including trimming, case conversion, and extraction.

```javascript
nexus.plugin('text').truncate('Hello world', 5);       // 'Hello...'
nexus.plugin('text').slugify('Hello World!');           // 'hello-world'
nexus.plugin('text').extractNumbers('abc123def456');     // ['123', '456']
```

#### markdown-plugin
Markdown parsing and rendering with syntax highlighting.

```javascript
nexus.plugin('markdown').parse('# Hello');       // HTML output
nexus.plugin('markdown').render(md);             // Rendered HTML
nexus.plugin('markdown').toPlainText(md);        // Strip markdown
```

#### json-plugin
JSON utilities for validation, manipulation, and transformation.

```javascript
nexus.plugin('json').validate(str);               // Check if valid JSON
nexus.plugin('json').query({a: {b: 1}}, 'a.b');   // JSONPath query
nexus.plugin('json').merge(obj1, obj2);          // Deep merge
```

#### csv-plugin
CSV parsing and generation with type inference.

```javascript
nexus.plugin('csv').parse('a,b,c\n1,2,3');        // Parse CSV
nexus.plugin('csv').generate(data);               // Convert to CSV
nexus.plugin('csv').toJSON(csv);                 // CSV to JSON
```

#### diff-plugin
Text diffing and comparison for changes and patches.

```javascript
nexus.plugin('diff').compare(text1, text2);       // Get differences
nexus.plugin('diff').patch(original, changes);  // Apply patch
nexus.plugin('diff').unified(diff);              // Unified diff format
```

#### regex-plugin
Regex pattern matching with common patterns included.

```javascript
nexus.plugin('regex').test('hello@example.com', 'email');  // Test email
nexus.plugin('regex').extract('tel: 123-456-7890', 'phone'); // Extract
nexus.plugin('regex').replace(str, pattern, replacement);  // Find & replace
```

#### emoji-plugin
Emoji utilities including shortcodes, conversion, and extraction.

```javascript
nexus.plugin('emoji').toShortcode('😀');           // ':smile:'
nexus.plugin('emoji').fromShortcode(':smile:');   // '😀'
nexus.plugin('emoji').extract('Hello 😀 World');  // ['😀']
```

#### xml-plugin
XML parsing and generation with namespace support.

```javascript
nexus.plugin('xml').parse('<root><item>1</item></root>');  // Parse XML
nexus.plugin('xml').generate({root: {item: 1}});           // Generate XML
nexus.plugin('xml').query(xml, '//item');                 // XPath query
```

---

### Security & Encoding (5)

#### hash-plugin
Cryptographic hashing with MD5, SHA-1, SHA-256, and more.

```javascript
nexus.plugin('hash').md5('Hello');               // MD5 hash
nexus.plugin('hash').sha256('Hello');             // SHA-256 hash
nexus.plugin('hash').bcrypt('password');         // bcrypt hash
nexus.plugin('hash').verify(hash, 'password');   // Verify hash
```

#### password-plugin
Password generation with configurable complexity and strength checking.

```javascript
nexus.plugin('password').generate(16, {upper: true, lower: true, number: true, symbol: true});
nexus.plugin('password').strength('MyP@ssw0rd!'); // {score: 4, crackTime: 'centuries'}
nexus.plugin('password').check('password123');    // Check against common passwords
```

#### uuid-plugin
UUID generation supporting v1, v4, and v5 UUIDs.

```javascript
nexus.plugin('uuid').v4();                        // UUID v4
nexus.plugin('uuid').v5('namespace', 'name');      // UUID v5
nexus.plugin('uuid').validate(uuid);              // Check validity
nexus.plugin('uuid').parse(uuid);                 // Parse components
```

#### validator-plugin
Data validation for email, URL, phone, credit card, and more.

```javascript
nexus.plugin('validator').isEmail('test@example.com');  // true
nexus.plugin('validator').isURL('https://example.com'); // true
nexus.plugin('validator').isCreditCard('4111111111111111'); // true
nexus.plugin('validator').isPhone('+1234567890');      // true
```

#### encoding-plugin
Text encoding and decoding including base64, hex, URL encoding.

```javascript
nexus.plugin('encoding').base64Encode('Hello');         // 'SGVsbG8='
nexus.plugin('encoding').base64Decode('SGVsbG8=');     // 'Hello'
nexus.plugin('encoding').urlEncode('Hello World!');    // 'Hello%20World%21'
nexus.plugin('encoding').hexEncode('Hello');           // '48656c6c6f'
```

---

### Data & Formats (6)

#### color-plugin
Color conversion and manipulation for RGB, HSL, HEX, and more.

```javascript
nexus.plugin('color').hexToRgb('#FF0000');          // {r: 255, g: 0, b: 0}
nexus.plugin('color').rgbToHsl(255, 0, 0);          // {h: 0, s: 100, l: 50}
nexus.plugin('color').lighten('#FF0000', 20);       // Lighter shade
nexus.plugin('color').darken('#FF0000', 20);        // Darker shade
nexus.plugin('color').contrast('#000', '#FFF');     // Check contrast ratio
```

#### url-plugin
URL parsing, manipulation, and query string handling.

```javascript
nexus.plugin('url').parse('https://example.com/path?a=1&b=2');
nexus.plugin('url').build({protocol: 'https', host: 'example.com', path: '/page'});
nexus.plugin('url').queryEncode({a: 1, b: 2});      // 'a=1&b=2'
nexus.plugin('url').queryDecode('a=1&b=2');        // {a: '1', b: '2'}
```

#### svg-plugin
SVG generation with shapes, paths, and icons.

```javascript
nexus.plugin('svg').circle(50, 50, 40);            // Circle element
nexus.plugin('svg').rect(10, 10, 100, 50);          // Rectangle
nexus.plugin('svg').path('M10 10 L90 90');          // Path
nexus.plugin('svg').icon('star', 24);               // Icon generation
```

#### chart-plugin
Chart generation for bar, line, pie, and scatter charts.

```javascript
nexus.plugin('chart').bar({data: [10, 20, 30], labels: ['A', 'B', 'C']});
nexus.plugin('chart').line({data: [1, 2, 3], labels: ['Jan', 'Feb', 'Mar']});
nexus.plugin('chart').pie({data: [30, 70], labels: ['Yes', 'No']});
nexus.plugin('chart').scatter({points: [[1,2], [3,4]]});
```

#### qrcode-plugin
QR code generation for URLs, text, WiFi, and contacts.

```javascript
nexus.plugin('qrcode').generate('https://example.com');
nexus.plugin('qrcode').generateWifi({ssid: 'MyNetwork', password: 'secret'});
nexus.plugin('qrcode').toDataURL('data');            // Base64 data URL
nexus.plugin('qrcode').toBuffer('data');            // Buffer for saving
```

#### format-plugin
Data formatting for currency, numbers, dates, and files.

```javascript
nexus.plugin('format').currency(1234.56, 'USD');    // '$1,234.56'
nexus.plugin('format').number(1234567, {separator: ','}); // '1,234,567'
nexus.plugin('format').bytes(1048576);             // '1.00 MB'
nexus.plugin('format').percentage(0.25);           // '25%'
```

---

### External Services (4)

#### translator-plugin
Multi-language translation using various providers.

```javascript
nexus.plugin('translator').translate('Hello', 'en', 'es');  // 'Hola'
nexus.plugin('translator').detect('Bonjour');                 // 'fr'
nexus.plugin('translator').languages();                        // List supported
```

#### weather-plugin
Weather information including current conditions and forecasts.

```javascript
nexus.plugin('weather').current('New York');          // Current weather
nexus.plugin('weather').forecast('New York', 7);     // 7-day forecast
nexus.plugin('weather').search('London');            // Search location
```

#### calendar-plugin
Calendar management for events, reminders, and scheduling.

```javascript
nexus.plugin('calendar').events(new Date());        // Today's events
nexus.plugin('calendar').create({title: 'Meeting', start: '2024-01-15T10:00'});
nexus.plugin('calendar').remind('Meeting in 15 min');
```

#### currency-plugin
Currency conversion with real-time exchange rates.

```javascript
nexus.plugin('currency').convert(100, 'USD', 'EUR');  // Convert USD to EUR
nexus.plugin('currency').rate('USD', 'GBP');          // Current rate
nexus.plugin('currency').historical('2024-01-01');   // Historical rates
```

---

### Specialized (4)

#### image-plugin
Image processing including resize, crop, rotate, and filters.

```javascript
nexus.plugin('image').resize(image, {width: 300, height: 200});
nexus.plugin('image').crop(image, {x: 0, y: 0, width: 100, height: 100});
nexus.plugin('image').rotate(image, 90);
nexus.plugin('image').filter(image, 'blur');         // Apply filter
nexus.plugin('image').watermark(image, logo);        // Add watermark
```

#### timezone-plugin
Timezone utilities for conversion and formatting.

```javascript
nexus.plugin('timezone').convert('2024-01-15T10:00', 'America/New_York', 'UTC');
nexus.plugin('timezone').list();                     // All timezones
nexus.plugin('timezone').offset('America/New_York');  // UTC offset
nexus.plugin('timezone').now('Asia/Tokyo');           // Current time in zone
```

#### graph-plugin
Graph data structure for relationships and networks.

```javascript
nexus.plugin('graph').addNode('A');
nexus.plugin('graph').addNode('B');
nexus.plugin('graph').addEdge('A', 'B', {weight: 1});
nexus.plugin('graph').path('A', 'B');               // Shortest path
nexus.plugin('graph').neighbors('A');                // Get neighbors
```

#### timezone-plugin
Statistical analysis utilities.

```javascript
nexus.plugin('stats').mean([1, 2, 3, 4, 5]);        // Calculate mean
nexus.plugin('stats').median([1, 2, 3, 4, 5]);      // Calculate median
nexus.plugin('stats').stdev([1, 2, 3, 4, 5]);      // Standard deviation
nexus.plugin('stats').percentile([1, 2, 3], 0.95); // Calculate percentile
```

---

### Infrastructure (23)

#### ipc-plugin
Inter-process communication for multi-process applications.

```javascript
nexus.plugin('ipc').send('channel', message);        // Send message
nexus.plugin('ipc').on('channel', handler);         // Listen for messages
nexus.plugin('ipc').request('channel', data);        // Request-response
```

#### logger-plugin
Structured logging with multiple outputs and levels.

```javascript
nexus.plugin('logger').info('Application started');
nexus.plugin('logger').warn('Low memory');
nexus.plugin('logger').error('Connection failed', {err});
nexus.plugin('logger').debug({key: 'value'});
```

#### jwt-plugin
JWT token generation and verification.

```javascript
nexus.plugin('jwt').sign({userId: 1}, 'secret');   // Generate token
nexus.plugin('jwt').verify(token, 'secret');        // Verify token
nexus.plugin('jwt').decode(token);                   // Decode payload
nexus.plugin('jwt').refresh(token, 'secret');        // Refresh token
```

#### pagination-plugin
Pagination utilities for arrays and API responses.

```javascript
nexus.plugin('pagination').paginate(items, {page: 1, limit: 10});
nexus.plugin('pagination').total(100, 10);          // Total pages
nexus.plugin('pagination').offset(2, 10);          // Calculate offset
nexus.plugin('pagination').range(1, 10);           // Page range
```

#### semver-plugin
Semantic versioning utilities.

```javascript
nexus.plugin('semver').valid('1.2.3');             // Check validity
nexus.plugin('semver').compare('1.2.3', '1.3.0');  // Compare versions
nexus.plugin('semver').bump('1.2.3', 'minor');     // Bump version
nexus.plugin('semver').parse('v1.2.3');            // Parse version
```

#### throttle-plugin
Throttling and debouncing for rate limiting.

```javascript
nexus.plugin('throttle').throttle(fn, 1000);        // Once per second
nexus.plugin('throttle').debounce(fn, 500);        // After 500ms idle
nexus.plugin('throttle').rateLimit(fn, 10, 60000); // 10 per minute
```

#### token-plugin
Token generation for authentication and APIs.

```javascript
nexus.plugin('token').generate(32);                 // Random token
nexus.plugin('token').secure();                    // Cryptographically secure
nexus.plugin('token').parse('Bearer xxx');         // Parse auth header
nexus.plugin('token').expire(token, 3600);         // Set expiration
```

#### idempotency-plugin
Idempotency keys for preventing duplicate operations.

```javascript
nexus.plugin('idempotency').key();                 // Generate key
nexus.plugin('idempotency').store(key, result);    // Store result
nexus.plugin('idempotency').get(key);              // Get cached result
nexus.plugin('idempotency').exists(key);           // Check existence
```

#### permission-plugin
Access control and role-based permissions.

```javascript
nexus.plugin('permission').grant(user, 'admin');   // Grant role
nexus.plugin('permission').revoke(user, 'admin');  // Revoke role
nexus.plugin('permission').check(user, 'read');    // Check permission
nexus.plugin('permission').roles();                // List roles
```

#### queue-plugin
Message queue for async processing.

```javascript
nexus.plugin('queue').enqueue('tasks', task);      // Add to queue
nexus.plugin('queue').dequeue('tasks');            // Get next item
nexus.plugin('queue').size('tasks');              // Queue size
nexus.plugin('queue').subscribe('tasks', handler); // Process queue
```

#### state-plugin
State machine for managing complex state flows.

```javascript
nexus.plugin('state').create('order', {
  initial: 'pending',
  states: ['pending', 'processing', 'shipped', 'delivered'],
  transitions: {...}
});
nexus.plugin('state').transition('order-123', 'shipped');
nexus.plugin('state').current('order-123');        // Get current state
```

#### config-plugin
Configuration management with validation and defaults.

```javascript
nexus.plugin('config').get('database.host');       // Get value
nexus.plugin('config').set('database.host', 'localhost');
nexus.plugin('config').merge({...});               // Merge config
nexus.plugin('config').validate(schema);          // Validate against schema
```

#### storage-plugin
Key-value storage with persistence.

```javascript
nexus.plugin('storage').set('key', value);        // Store value
nexus.plugin('storage').get('key');               // Get value
nexus.plugin('storage').delete('key');            // Delete key
nexus.plugin('storage').list('prefix');           // List keys with prefix
nexus.plugin('storage').clear();                  // Clear all
```

#### events-plugin
Event emitter for pub/sub patterns.

```javascript
nexus.plugin('events').emit('user:created', user); // Publish event
nexus.plugin('events').on('user:created', handler); // Subscribe
nexus.plugin('events').once('init', handler);      // One-time listener
nexus.plugin('events').off('user:created', handler); // Unsubscribe
```

#### stream-plugin
Stream processing for large data handling.

```javascript
nexus.plugin('stream').create({...});              // Create stream
nexus.plugin('stream').pipe(source, dest);          // Pipe streams
nexus.plugin('stream').transform(stream, fn);      // Transform data
nexus.plugin('stream').buffer(stream, size);       // Buffer chunks
```

#### memoize-plugin
Function memoization for caching expensive computations.

```javascript
nexus.plugin('memoize')(expensiveFunction, options);
nexus.plugin('memoize').clear(fn);                 // Clear cache
nexus.plugin('memoize').stats(fn);                // Cache statistics
```

#### pipeline-plugin
Data pipeline construction and execution.

```javascript
nexus.plugin('pipeline').create()
  .source(data)
  .transform(step1)
  .filter(step2)
  .aggregate(step3)
  .sink(output);
nexus.plugin('pipeline').execute(pipeline);
```

#### router-plugin
HTTP routing for middleware and API endpoints.

```javascript
nexus.plugin('router').get('/api/users', handler);
nexus.plugin('router').post('/api/users', handler);
nexus.plugin('router').use(middleware);
nexus.plugin('router').match('GET', '/api/users');
```

#### flag-plugin
Feature flags for gradual rollouts and A/B testing.

```javascript
nexus.plugin('flag').enable('new-feature');
nexus.plugin('flag').disable('old-feature');
nexus.plugin('flag').isEnabled('feature-name');
nexus.plugin('flag').isEnabled('feature-name', {userId: 1}); // User-specific
nexus.plugin('flag').variants('experiment');       // Get variants
```

#### retry-plugin
Retry utilities with exponential backoff.

```javascript
nexus.plugin('retry').execute(fn, {retries: 3, backoff: 1000});
nexus.plugin('retry').withRetry(promise, {retries: 3});
nexus.plugin('retry').circuitBreaker(fn, {threshold: 5});
```

#### rate-limit-plugin
Rate limiting for API protection.

```javascript
nexus.plugin('rate-limit').check('client-1', 100, 60000); // 100 per minute
nexus.plugin('rate-limit').isAllowed('client-1');
nexus.plugin('rate-limit').reset('client-1');
nexus.plugin('rate-limit').window(60);             // 60-second window
```

#### batch-plugin
Batch processing for bulk operations.

```javascript
nexus.plugin('batch').process(items, handler, {batchSize: 100});
nexus.plugin('batch').parallel(items, handler, {concurrency: 5});
nexus.plugin('batch').chunk(items, 10);            // Split into chunks
nexus.plugin('batch').merge(results);             // Merge batch results
```

---

## Plugin Development

### Creating a Plugin

```javascript
// my-plugin.js
export default {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'A custom plugin for NEXUS',
  
  init: async (context) => {
    console.log('Plugin initializing...');
  },
  
  activate: async (context) => {
    console.log('Plugin activated');
  },
  
  deactivate: async () => {
    console.log('Plugin deactivated');
  },
  
  hooks: {
    'app:beforeStart': async (data) => {
      console.log('App starting with config:', data.config);
    }
  },
  
  functions: {
    hello: async (args) => {
      return `Hello, ${args.name || 'World'}!`;
    }
  }
};
```

### Registering a Plugin

```javascript
// In server initialization
await nexus.plugins.register('./plugins/my-plugin.js');
```

### Plugin Configuration

```yaml
plugins:
  my-plugin:
    enabled: true
    config:
      option1: value1
      option2: value2
```

---

## Best Practices

1. **Error Handling**: Always wrap async operations in try/catch
2. **Resource Cleanup**: Clean up resources in deactivate()
3. **Type Safety**: Use TypeScript for better plugin development
4. **Testing**: Write tests for each plugin function
5. **Documentation**: Document all functions with JSDoc comments
6. **Performance**: Use memoization for expensive operations
7. **Security**: Validate all inputs and sanitize outputs

---

## Plugin Manager API

```javascript
// Register plugin
await nexus.plugins.register(plugin);

// Enable/disable plugin
nexus.plugins.enable('plugin-id');
nexus.plugins.disable('plugin-id');

// Get plugin
const plugin = nexus.plugins.get('plugin-id');

// List all plugins
const plugins = nexus.plugins.list();

// Call plugin function
const result = await nexus.plugins.call('plugin-id', 'functionName', args);
```
