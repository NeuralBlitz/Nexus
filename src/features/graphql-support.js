import { EventEmitter } from 'events';
import crypto from 'crypto';

export class GraphQLType {
  constructor(name) {
    this.name = name;
    this.fields = new Map();
    this.interfaces = [];
    this.description = null;
  }

  field(name, type, resolver = null) {
    this.fields.set(name, { type, resolver, args: [] });
    return this;
  }

  arg(name, type, defaultValue = undefined) {
    const lastField = Array.from(this.fields.values()).pop();
    if (lastField) {
      lastField.args.push({ name, type, defaultValue });
    }
    return this;
  }

  implements(iface) {
    this.interfaces.push(iface);
    return this;
  }

  toSDL() {
    let sdl = this.description ? `# ${this.description}\n` : '';
    sdl += `type ${this.name}`;
    if (this.interfaces.length > 0) {
      sdl += ` implements ${this.interfaces.join(' & ')}`;
    }
    sdl += ' {\n';

    for (const [name, field] of this.fields) {
      const args = field.args.length > 0
        ? `(${field.args.map(a => `${a.name}: ${a.type}`).join(', ')})`
        : '';
      sdl += `  ${name}${args}: ${field.type}\n`;
    }

    sdl += '}';
    return sdl;
  }
}

export class GraphQLResolver {
  constructor(name, fn) {
    this.name = name;
    this.fn = fn;
    this.parent = null;
    this.args = {};
  }

  resolve(parent, args, context, info) {
    return this.fn(parent, args, context, info);
  }
}

export class GraphQLSchema extends EventEmitter {
  constructor(options = {}) {
    super();

    this.queryType = null;
    this.mutationType = null;
    this.subscriptionType = null;
    this.types = new Map();
    this.resolvers = new Map();
    this.scalars = new Map();
    this.directives = new Map();
    this.middlewares = [];

    this.registerDefaultScalars();
  }

  registerDefaultScalars() {
    this.registerScalar('String', {
      serialize: (v) => String(v),
      parseValue: (v) => String(v)
    });

    this.registerScalar('Int', {
      serialize: (v) => parseInt(v),
      parseValue: (v) => parseInt(v)
    });

    this.registerScalar('Float', {
      serialize: (v) => parseFloat(v),
      parseValue: (v) => parseFloat(v)
    });

    this.registerScalar('Boolean', {
      serialize: (v) => Boolean(v),
      parseValue: (v) => Boolean(v)
    });

    this.registerScalar('ID', {
      serialize: (v) => String(v),
      parseValue: (v) => String(v)
    });
  }

  type(name, definition) {
    const type = new GraphQLType(name);
    definition(type);
    this.types.set(name, type);
    return this;
  }

  query(definition) {
    this.queryType = {};
    definition(this.queryType);
    return this;
  }

  mutation(definition) {
    this.mutationType = {};
    definition(this.mutationType);
    return this;
  }

  subscription(definition) {
    this.subscriptionType = {};
    definition(this.subscriptionType);
    return this;
  }

  resolver(path, fn) {
    const resolver = new GraphQLResolver(path, fn);
    this.resolvers.set(path, resolver);
    return this;
  }

  registerScalar(name, handlers) {
    this.scalars.set(name, handlers);
  }

  registerDirective(name, directive) {
    this.directives.set(name, directive);
  }

  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(query, variables = {}, context = {}) {
    const parsed = this.parseQuery(query);

    if (!parsed) {
      throw new Error('Invalid query');
    }

    for (const middleware of this.middlewares) {
      await middleware(context, parsed);
    }

    const result = await this.executeOperation(parsed, variables, context);
    return { data: result };
  }

  parseQuery(query) {
    if (typeof query === 'string') {
      try {
        return this.parse(query);
      } catch {
        return null;
      }
    }
    return query;
  }

  parse(queryString) {
    const selections = [];
    const lines = queryString.trim().split(/[\s,{]+/);

    let currentOp = 'query';
    const parsed = { operation: currentOp, selections: [] };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === 'query' || line === 'mutation' || line === 'subscription') {
        currentOp = line;
        parsed.operation = currentOp;
      } else if (line && !['{', '}'].includes(line)) {
        const fieldName = line.replace(/[()]/g, '');
        if (fieldName) {
          parsed.selections.push({ name: fieldName, arguments: [] });
        }
      }
    }

    return parsed;
  }

  async executeOperation(operation, variables, context) {
    const results = {};

    for (const selection of operation.selections) {
      const resolver = this.resolvers.get(selection.name);

      if (resolver) {
        const args = this.parseArgs(selection.arguments, variables);
        results[selection.name] = await resolver.resolve(null, args, context, operation);
      } else {
        results[selection.name] = null;
      }
    }

    return results;
  }

  parseArgs(args, variables) {
    const parsed = {};
    for (const arg of args) {
      if (arg.value.startsWith('$')) {
        parsed[arg.name] = variables[arg.value.slice(1)];
      } else {
        parsed[arg.name] = this.parseLiteral(arg.value);
      }
    }
    return parsed;
  }

  parseLiteral(value) {
    if (value === 'null') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^-?\d+$/.test(value)) return parseInt(value);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    return value;
  }

  getIntrospection() {
    return {
      types: Array.from(this.types.values()).map(t => ({
        name: t.name,
        fields: Array.from(t.fields.keys())
      })),
      queryType: this.queryType ? Object.keys(this.queryType) : [],
      mutationType: this.mutationType ? Object.keys(this.mutationType) : [],
      subscriptionType: this.subscriptionType ? Object.keys(this.subscriptionType) : []
    };
  }

  generateSDL() {
    let sdl = '';

    for (const type of this.types.values()) {
      sdl += type.toSDL() + '\n\n';
    }

    if (this.queryType) {
      sdl += 'type Query {\n';
      for (const name of Object.keys(this.queryType)) {
        sdl += `  ${name}: String\n`;
      }
      sdl += '}\n\n';
    }

    return sdl;
  }
}

export class GraphQLServer extends EventEmitter {
  constructor(schema, options = {}) {
    super();

    this.schema = schema;
    this.path = options.path || '/graphql';
    this.playground = options.playground !== false;
    this.introspection = options.introspection !== false;
  }

  getMiddleware() {
    return async (req, res) => {
      if (req.method === 'GET' && this.playground && req.path === this.path) {
        return this.renderPlayground(req, res);
      }

      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      try {
        const body = req.body;
        const query = body.query;
        const variables = body.variables || {};
        const operationName = body.operationName;

        const result = await this.schema.execute(query, variables, { req });

        res.setHeader('Content-Type', 'application/json');
        res.json(result);
      } catch (error) {
        res.status(400).json({
          errors: [{ message: error.message }]
        });
      }
    };
  }

  renderPlayground(req, res) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>GraphQL Playground</title>
  <style>
    body { margin: 0; font-family: sans-serif; }
    #playground { height: 100vh; }
  </style>
</head>
<body>
  <div id="playground">
    <h1>GraphQL Playground</h1>
    <p>GraphQL endpoint: ${this.path}</p>
  </div>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}

let graphqlSchema = null;

export function getGraphQLSchema(options = {}) {
  if (!graphqlSchema) {
    graphqlSchema = new GraphQLSchema(options);
  }
  return graphqlSchema;
}

export default { GraphQLSchema, GraphQLType, GraphQLResolver, GraphQLServer, getGraphQLSchema };
