import Log from '../models/Log.js';

const logAction = async (req, res, next) => {
  try {
    console.log('logAction middleware chamado - Método:', req.method, 'Caminho:', req.path, 'req.user:', req.user);

    // Determinar a ação com base no método HTTP
    const actionMap = {
      post: 'create',
      put: 'update',
      delete: 'delete',
      get: 'list',
    };
    const baseAction = actionMap[req.method.toLowerCase()] || req.method.toLowerCase();

    // Extrair o módulo a partir do caminho
    const pathParts = req.path.split('/').filter(Boolean);
    const module = pathParts[0] || 'acesso'; // Usa o primeiro segmento como módulo, fallback para 'acesso'

    // Construir a ação mapeada
    const mappedAction = `${baseAction}-${module}`;

    // Extrair informações específicas da entidade
    let entityName = null;
    let entityDate = null;

    if (module === 'comunicados') {
      entityName = req.body?.titulo || (req.params?.id ? `ID: ${req.params.id}` : null);
      entityDate = req.body?.data || null;
    } else if (module === 'beneficiarios') {
      entityName = req.body?.nome || null;
    } else if (module === 'treinamentos') {
      entityName = req.body?.nomeEvento || null;
      entityDate = req.body?.dataRealizacao || null;
    } else if (module === 'avaliacoes') {
      entityName = req.body?.titulo || null;
      entityDate = req.body?.data || null;
    } else if (module === 'usuarios') {
      entityName = req.body?.name || null;
    }

    // Preparar dados do log
    const logData = {
      userId: req.user?._id || null,
      userName: req.user?.name || 'Usuário Desconhecido',
      action: mappedAction,
      module,
      details: `${req.user?.name || 'Usuário Desconhecido'} realizou ${baseAction} em ${module}${
        entityName ? ` (${entityName})` : ''
      }${entityDate ? ` em ${new Date(entityDate).toLocaleDateString('pt-BR')}` : ''}`,
      timestamp: new Date(),
    };

    console.log('Dados do log a serem registrados:', logData);

    // Registrar o log, exceto para ações de listagem
    if (!baseAction === 'list') {
      const logCriado = await Log.create(logData);
      console.log('Log registrado com sucesso:', logCriado);
    } else {
      console.log('Ação de listagem detectada, log não registrado.');
    }

    // Sobrescrever o método res.json para capturar o status da resposta
    const originalJson = res.json;
    res.json = function (body) {
      if (res.statusCode >= 400) {
        const errorAction = `${baseAction}-error`;
        const errorLogData = {
          ...logData,
          action: `${errorAction}-${module}`,
          details: `${logData.details} - Erro: ${body.message || 'Falha na operação'}`,
        };
        Log.create(errorLogData).catch((err) => console.error('Erro ao registrar log de erro:', err));
      }
      originalJson.call(this, body);
    };

  } catch (error) {
    console.error('Erro ao registrar ação no logAction:', error.message);
    console.error(error.stack);
  } finally {
    next();
  }
};

export default logAction;