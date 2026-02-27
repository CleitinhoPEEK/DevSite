(function attachFinI18nExtra(global) {
  'use strict';

  if (!global) return;

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function deepMerge(target, source) {
    var out = isObject(target) ? target : {};
    if (!isObject(source)) return out;

    Object.keys(source).forEach(function (key) {
      var srcVal = source[key];
      var curVal = out[key];
      if (isObject(srcVal)) out[key] = deepMerge(curVal, srcVal);
      else out[key] = srcVal;
    });

    return out;
  }

  var extraMessages = {
    'pt-BR': {
      common: {
        remove: 'Remover',
        edit: 'Editar',
        save: 'Salvar',
        saveItem: 'Salvar item',
        clear: 'Limpar',
        export: 'Exportar',
        exclude: 'Excluir',
        menuPage: 'Menu',
        openAppMenu: 'Abrir menu do aplicativo'
      },
      pwa: {
        ui: {
          installAria: 'Instalar aplicativo',
          installButton: 'Instalar app',
          closeModalAria: 'Fechar aviso'
        },
        logs: {
          localhostSwRemoved: 'Service Workers removidos em localhost para evitar cache durante desenvolvimento.',
          notSupported: 'Service Worker nao suportado neste navegador.',
          insecureContext: 'Contexto inseguro; SW nao registrado.',
          localhostDisabled: 'SW desativado em localhost. Use ?pwa-sw=1 ou localStorage["{key}"]="1" para testar.',
          installPromptOpenFail: 'Falha ao abrir prompt de instalacao:',
          installPromptResult: 'Resultado do prompt de instalacao:',
          unknown: 'desconhecido',
          beforeInstallPrompt: 'beforeinstallprompt recebido.',
          appInstalled: 'App instalado.'
        },
        install: {
          failTitle: 'Falha na instalacao',
          failMessage: 'Nao foi possivel abrir o prompt de instalacao agora.',
          startedTitle: 'Instalacao iniciada',
          startedMessage: 'O navegador vai concluir a instalacao do app.',
          cancelledTitle: 'Instalacao cancelada',
          cancelledMessage: 'Voce pode tentar novamente quando o navegador liberar um novo prompt.',
          availableTitle: 'App instalavel',
          availableMessage: 'Voce ja pode instalar o Finances neste dispositivo.',
          doneTitle: 'App instalado',
          doneMessage: 'Agora o Finances pode abrir em modo standalone.'
        },
        update: {
          title: 'Nova versao disponivel',
          message: 'Uma atualizacao do app foi baixada. Deseja atualizar agora?',
          confirm: 'Atualizar',
          later: 'Depois'
        }
      },
      menu: {
        userGeneric: 'Usuario',
        developer: 'Desenvolvedor',
        patchNotes: {
          button: 'Patch notes',
          buttonAria: 'Abrir patch notes',
          kicker: 'Patch notes',
          title: 'Historico de atualizacoes',
          subtitle: 'Confira data e hora de lancamento de cada versao e o que foi alterado.',
          empty: 'Nenhuma atualizacao registrada ainda.',
          close: 'Fechar patch notes',
          latestBadge: 'Mais recente',
          changesLabel: 'O que mudou',
          noDetails: 'Sem detalhes nesta versao.',
          versionLabel: 'Versao {versao}',
          releasedAt: 'Lancado em {data}',
          entryTitleFallback: 'Atualizacao',
          devToolsTitle: 'Ferramentas de dev',
          new: 'Novo patch',
          exportJson: 'Exportar JSON',
          importJson: 'Importar JSON',
          edit: 'Editar',
          delete: 'Excluir',
          save: 'Salvar patch',
          cancel: 'Cancelar',
          labelVersion: 'Versao',
          labelDateTime: 'Data e hora',
          labelTitlePt: 'Titulo (PT-BR)',
          labelTitleEn: 'Titulo (EN-US)',
          labelChangesPt: 'Mudancas (PT-BR)',
          labelChangesEn: 'Mudancas (EN-US)',
          placeholderVersion: '2026.02.25-01',
          placeholderTitlePt: 'Titulo em portugues',
          placeholderTitleEn: 'Title in English',
          placeholderChanges: 'Uma mudanca por linha',
          editorHint: 'Use uma linha por item de mudanca.',
          saved: 'Patch note salvo com sucesso.',
          deleted: 'Patch note removido.',
          exportDone: 'Patch notes exportados em JSON.',
          importDone: 'Patch notes importados com sucesso.',
          importInvalid: 'JSON invalido para patch notes.',
          importReadError: 'Nao foi possivel ler o arquivo JSON.',
          deleteConfirm: 'Deseja excluir este patch note?',
          validation: {
            versionRequired: 'Informe a versao do patch.',
            dateRequired: 'Informe a data e hora do lancamento.',
            titleRequired: 'Informe pelo menos um titulo (PT-BR ou EN-US).',
            invalidDate: 'Data/hora invalida.',
            invalidEntry: 'Nao foi possivel salvar este patch.'
          }
        },
        groups: {
          operacao: { title: 'Operacao financeira', description: 'Fluxo diario de clientes, entradas, saidas e caixa.' },
          relatorios: { title: 'Relatorios e analises', description: 'Visoes consolidadas anuais e comparativos por periodo.' },
          acesso: { title: 'Acesso e conta', description: 'Paginas de autenticacao e entrada no sistema.' },
          sistema: { title: 'Sistema e suporte', description: 'Paginas auxiliares do PWA e fallback do aplicativo.' }
        },
        pages: {
          dashboard: { title: 'Painel financeiro', description: 'Tela principal com clientes, pagamentos e acoes rapidas.' },
          economias: { title: 'Economias', description: 'Carteira, extrato, poupanca e controle de saldo.' },
          despesas: { title: 'Despesas', description: 'Lancamentos de gastos e controle mensal de despesas.' },
          comercio: { title: 'Modo comercio', description: 'Comanda, vendas do dia, catalogo e extrato consolidado.' },
          resumoAno: { title: 'Resumo anual', description: 'Resumo executivo anual com graficos e totais consolidados.' },
          resumoEconomias: { title: 'Resumo economias', description: 'Evolucao de carteira e poupanca com analise por meses.' },
          login: { title: 'Login', description: 'Tela de acesso ao sistema com usuario e senha.' },
          offline: { title: 'Offline (fallback PWA)', description: 'Pagina exibida quando o app esta sem internet.' },
          devTools: { title: 'Dev Tools', description: 'Ferramentas internas para diagnostico, simulacao e manutencao do app.' }
        },
        tags: {
          principal: 'Principal',
          protegida: 'Protegida',
          carteira: 'Carteira',
          mensal: 'Mensal',
          vendas: 'Vendas',
          executivo: 'Executivo',
          evolucao: 'Evolucao',
          publica: 'Publica',
          autenticacao: 'Autenticacao',
          interna: 'Interna',
          pwa: 'PWA',
          dev: 'DEV'
        }
      },
      resumoEconomias: {
        mainTitle: 'Resumo de economias',
        cards: {
          totalReceived12m: 'Total recebido (12 meses)',
          totalExpenses12m: 'Total em despesas (12 meses)',
          currentWallet: 'Saldo atual carteira',
          currentSavings: 'Saldo atual poupanca'
        },
        chart: {
          title: 'Disponivel x poupanca por mes',
          available: 'Disponivel',
          savings: 'Poupanca'
        },
        table: {
          headers: {
            month: 'Mes',
            available: 'Disponivel',
            savings: 'Poupanca',
            savingsAccum: 'Acumulado poupanca'
          }
        },
        methods: {
          title: 'Recebimentos por metodo de pagamento',
          subtitle: 'Veja quanto foi recebido por metodo e acompanhe o valor mes a mes.',
          selectLabel: 'Selecionar metodo',
          selectAria: 'Selecionar metodo de pagamento no resumo de economias',
          all: 'Todos os metodos',
          receivedInMethod: 'Recebido no metodo'
        }
      },
      economias: {
        pageTitle: 'Extrato',
        subtitle: 'Acompanhe movimentacoes da carteira e poupanca em um painel simples.',
        tabs: {
          wallet: 'Carteira',
          savings: 'Poupanca'
        },
        forms: {
          walletDescriptionPlaceholder: 'Descricao (Ex: Viagem)',
          savingsDescriptionPlaceholder: 'Descricao (Ex: Guardar para carro)'
        },
        actions: {
          in: 'Entrou',
          out: 'Saiu',
          transferToSavings: 'Transferir para poupanca',
          save: 'Guardar',
          withdraw: 'Resgatar',
          sendToWallet: 'Enviar para carteira'
        },
        monthMenu: {
          openYearSummary: 'Abrir resumo anual de {ano}'
        },
        wallet: {
          monthBalance: 'Saldo do mes ({mes})',
          availableBalance: 'Saldo disponivel (carteira)'
        },
        savings: {
          monthBalance: 'Poupanca do mes ({mes})',
          totalInvested: 'Total investido (poupanca)'
        },
        extrato: {
          walletTitle: 'Extrato da carteira',
          savingsTitle: 'Historico da poupanca',
          filterLabel: 'Metodo',
          filterAria: 'Filtrar extrato por metodo de pagamento',
          emptyMonth: 'Nenhuma movimentacao em {mes}.',
          filter: {
            all: 'Todos',
            withMethod: 'Com metodo identificado',
            withoutMethod: 'Sem identificacao'
          },
          details: {
            type: 'Tipo',
            category: 'Categoria',
            paymentMethod: 'Forma de pagamento',
            value: 'Valor',
            datetime: 'Data/Hora',
            typeIn: 'Entrada',
            typeOut: 'Saida',
            noCategory: 'Sem categoria',
            notInformed: 'Nao informado'
          },
          descriptions: {
            received: 'Recebido',
            reversal: 'Estorno',
            manualAdjustment: 'Ajuste manual',
            manualCorrection: 'Correcao manual',
            expenseCreatedPaid: 'Despesa cadastrada como paga',
            expensePayment: 'Pagamento de despesa',
            expenseReversal: 'Estorno de despesa',
            expenseAdjustmentReversal: 'Estorno de ajuste de despesa',
            recurringAdjustmentReversal: 'Estorno de ajuste de recorrencia',
            paidRecurringAdjustment: 'Ajuste de recorrencia paga',
            commerceMode: 'Modo Comercio',
            savingsWithdrawalToWallet: 'Resgate da Poupanca',
            transferToSavings: 'Transferencia para Poupanca',
            comingFromWallet: 'Vindo da Carteira',
            sentToWallet: 'Enviado para Carteira',
            savingsInvestment: 'Investimento',
            savingsRedeem: 'Resgate'
          }
        }
      },
      despesas: {
        mainTitle: 'Despesas Fixas e Contas',
        subtitle: 'Acompanhe pendencias, pagamentos e o total do periodo em um painel simples.',
        cards: { toPay: 'Total a Pagar', paid: 'Total Pago', total: 'Total Geral' },
        buttons: { newExpense: 'Nova Despesa', save: 'Salvar' },
        tabs: { all: 'Todas', pending: 'Pendentes', paid: 'Pagas', overdue: 'Atrasadas' },
        modal: {
          createTitle: 'Cadastrar Conta',
          editTitle: 'Editar Conta',
          namePlaceholder: 'Nome da conta',
          valuePlaceholder: 'Valor',
          statusPending: 'Pendente',
          statusPaid: 'Pago',
          recurringMonthly: 'Recorrente mensal'
        },
        menu: {
          expandMonths: 'Expandir meses',
          collapseMonths: 'Recolher meses',
          currentMonth: 'Mes atual'
        },
        notifications: {
          alerts: 'Alertas de despesas',
          overdue: 'Vencidas',
          dueToday: 'Vencem hoje',
          dueTomorrow: 'Vencem amanha',
          overdueOn: 'Venceu em',
          dueTodaySingle: 'Vence hoje',
          dueTomorrowSingle: 'Vence amanha'
        },
        alerts: {
          fillFields: 'Preencha todos os campos',
          notFound: 'Despesa nao encontrada'
        }
      },
      comercioPage: {
        meta: {
          title: 'Modo comercio | Finances'
        },
        common: {
          ticketAverage: 'Ticket medio: {valor}',
          edit: 'Editar',
          save: 'Salvar',
          saveItem: 'Salvar item',
          clear: 'Limpar',
          export: 'Exportar',
          exclude: 'Excluir'
        },
        paymentMethods: {
          notInformed: 'Nao informar',
          pix: 'PIX',
          cash: 'Dinheiro',
          debit: 'Debito',
          credit: 'Credito',
          transfer: 'Transferencia',
          boleto: 'Boleto'
        },
        units: {
          sales: '{q} venda(s)',
          items: '{q} item(ns)',
          unitsShort: '{q} un.',
          days: '{q} dia(s)'
        },
        statuses: {
          exported: 'Exportado',
          pending: 'Pendente'
        },
        periods: {
          today: 'Hoje',
          last7Days: 'Ultimos 7 dias',
          last15Days: 'Ultimos 15 dias',
          last30Days: 'Ultimos 30 dias'
        },
        filters: {
          allMethods: 'Todos os metodos',
          noMethod: 'Sem metodo informado'
        },
        dialogs: {
          close: 'Fechar',
          cancel: 'Cancelar',
          confirmTitle: 'Confirmar',
          confirmationTitle: 'Confirmacao',
          confirm: 'Confirmar',
          exportToStatementTitle: 'Exportar para extrato',
          exportToStatementMessage: 'Exportar {vendas} para o extrato?\nTotal: {total}',
          removeSaleTitle: 'Remover venda',
          removeSaleMessage: 'Remover esta venda da lista do dia?',
          removeExportedSaleMessage: 'Este registro ja foi exportado. Remover somente da lista do dia?',
          clearExportedTitle: 'Limpar exportadas',
          clearExportedMessage: 'Remover da lista do dia todos os registros ja exportados?',
          clearOrderTitle: 'Limpar comanda',
          clearOrderMessage: 'Limpar a comanda atual?',
          removeCatalogItemTitle: 'Remover item',
          removeCatalogItemMessage: 'Remover o item "{nome}" do catalogo?'
        },
        header: {
          kicker: 'Modo comercio',
          title: 'Central de vendas',
          subtitle: 'Monte uma comanda com varios itens, aplique desconto/acrescimo e exporte manualmente para o extrato da carteira.',
          buttons: {
            economias: 'Economias'
          }
        },
        summary: {
          aria: 'Resumo de vendas do dia',
          cards: {
            totalDay: 'Total do dia',
            pendingExport: 'Pendentes para exportar',
            itemsSoldToday: 'Itens vendidos hoje',
            date: 'Data'
          }
        },
        reports: {
          aria: 'Relatorios diario e semanal',
          title: 'Relatorios',
          subtitle: 'Resumo diario e semanal com totais, pendencias e formas de pagamento.',
          detailPeriod: 'Detalhar periodo',
          paymentMethodsTitle: 'Formas de pagamento • {periodo}',
          noSalesSelectedPeriod: 'Sem vendas no periodo selecionado.',
          cards: {
            todayTotal: 'Hoje • Total',
            todayPending: 'Hoje • Pendente',
            weekTotal: '7 dias • Total',
            weekPending: '7 dias • Pendente'
          }
        },
        panel: {
          aria: 'Configuracoes rapidas'
        },
        catalog: {
          addButton: 'Adicionar ao catalogo',
          newItemTitle: 'Novo item',
          newItemSubtitle: 'Cadastre nome, preco e custo opcional.',
          closeItemFormAria: 'Fechar cadastro de item',
          placeholders: {
            name: 'Ex.: Agua 500ml',
            price: 'Preco (ex.: 5,00)',
            cost: 'Custo (opcional)'
          },
          sectionTitle: 'Itens (placas)',
          sectionSubtitle: 'Toque nos blocos para adicionar a comanda atual.',
          searchLabel: 'Buscar produto',
          searchPlaceholder: 'Digite o nome do item',
          clearSearch: 'Limpar busca',
          empty: 'Nenhum item no catalogo.',
          notFound: 'Nenhum produto encontrado para "{termo}".',
          costLabel: 'Custo: {valor}',
          addToOrder: 'Adicionar a comanda',
          editItemTitle: 'Editar item',
          editItemMessage: 'Atualize nome, preco e custo do item.',
          itemNameLabel: 'Nome do item',
          priceLabel: 'Preco (R$)',
          costOptionalLabel: 'Custo (R$) - opcional'
        },
        order: {
          aria: 'Comanda atual',
          title: 'Comanda atual',
          emptyHint: 'Monte a comanda tocando nos itens acima.',
          empty: 'A comanda esta vazia.',
          clear: 'Limpar comanda',
          finishSale: 'Fechar venda',
          identificationOptional: 'Identificacao (opcional)',
          identificationPlaceholder: 'Ex.: Mesa 3 / Cliente Joao',
          paymentMethod: 'Forma de pagamento',
          discount: 'Desconto (R$)',
          increase: 'Acrescimo (R$)',
          summaryShort: '{itens} • {total} • {forma}',
          summaryFull: '{itens} | {total} | custo {custo} | lucro {lucro} | {forma}',
          eachPrice: '{valor} cada',
          costInline: 'custo {valor}',
          totalMustBePositive: 'O total final precisa ser maior que zero.',
          totals: {
            subtotal: 'Subtotal',
            discount: 'Desconto',
            increase: 'Acrescimo',
            finalTotal: 'Total final'
          }
        },
        tabs: {
          aria: 'Abas de vendas e extrato',
          switchAria: 'Alternar entre vendas, extrato e relatorio de itens',
          salesDay: 'Lista de vendas do dia',
          statement: 'Extrato do comercio',
          itemsReport: 'Relatorio de itens'
        },
        sales: {
          listTitle: 'Lista de vendas do dia',
          clearExported: 'Limpar exportadas',
          fallbackSale: 'Venda',
          discountShort: 'Desc. {valor}',
          increaseShort: 'Acresc. {valor}',
          subtotalLabel: 'Subtotal: {valor}',
          daySummary: '{vendas} no dia • {pendente} pendente(s) de exportacao.',
          noneLaunchedYet: 'Nenhuma venda lancada ainda.',
          noneMatchFilter: 'Nenhuma venda corresponde ao filtro selecionado.',
          noneToday: 'Nenhuma venda registrada hoje.',
          useTemplate: 'Usar modelo'
        },
        statement: {
          aria: 'Extrato do comercio',
          title: 'Extrato do comercio',
          subtitle: 'Historico consolidado das vendas do modo comercio, com custo e lucro estimado.',
          exportButton: 'Exportar para extrato',
          recordsCount: '{q} registro(s){sufixo}',
          last120Suffix: ' (ultimos 120)',
          empty: 'Nenhuma exportacao consolidada registrada no extrato do comercio ainda.',
          batchExportTitle: 'Exportacao consolidada - {data}',
          profitLabel: 'Lucro: {valor}',
          noBatchSummary: 'Sem resumo das vendas desse lote',
          modePrefix: 'Modo Comercio',
          exportToWalletDescription: 'Modo Comercio: Exportacao consolidada ({vendas}, {itens})',
          cards: {
            revenue: 'Receita',
            cost: 'Custo',
            profit: 'Lucro estimado',
            exportedPending: 'Exportadas / Pendentes'
          },
          totals: {
            sales: 'Vendas',
            items: 'Itens',
            revenue: 'Receita',
            cost: 'Custo',
            profit: 'Lucro'
          }
        },
        itemsReport: {
          aria: 'Relatorio de itens',
          title: 'Relatorio de itens',
          subtitle: 'Desempenho por item com base nas vendas do modo comercio.',
          periodLabel: 'Periodo',
          noData: 'Sem dados suficientes no periodo.',
          unitsInPeriod: '{q} un. no periodo',
          genericItem: 'Item',
          cards: {
            topSold: 'Item mais vendido',
            topProfit: 'Item mais lucrativo',
            topRevenue: 'Maior faturamento',
            itemsWithSales: 'Itens com vendas'
          },
          blocks: {
            rankQty: 'Ranking por quantidade',
            top5: 'Top 5',
            rankProfit: 'Ranking por lucro',
            lowTurnover: 'Itens com baixo giro',
            lowestOutput: 'Menor saida',
            periodSummary: 'Resumo do periodo',
            revenueVsCost: 'Receita x custo'
          },
          summary: {
            totalRevenue: 'Receita total',
            totalCost: 'Custo total',
            estimatedProfit: 'Lucro estimado',
            ticketPerSale: 'Ticket medio por venda',
            lowTurnoverItems: 'Itens com baixa saida (<= 2 un.)',
            itemsWithoutSales: 'Itens sem venda no catalogo'
          }
        },
        feedback: {
          itemAddedToOrder: 'Item adicionado a comanda: {nome}.',
          saleRecorded: 'Venda registrada ({valor}).',
          noPendingSalesToExport: 'Nao ha vendas pendentes para exportar.',
          exportDoneSingleEntry: 'Exportacao concluida: {vendas} consolidadas em 1 lancamento no extrato.',
          saleRemovedFromDayList: 'Registro removido da lista do dia.',
          saleLoadedAsTemplate: 'Venda carregada como modelo na comanda.',
          noExportedRecordsToClear: 'Nao ha registros exportados para limpar.',
          exportedRecordsCleared: 'Registros exportados removidos da lista.',
          itemNameRequired: 'Nome do item nao pode ficar vazio.',
          invalidPrice: 'Preco invalido.',
          itemUpdated: 'Item atualizado: {nome}.',
          itemRemovedFromCatalog: 'Item removido do catalogo: {nome}.',
          orderAlreadyEmpty: 'A comanda ja esta vazia.',
          orderCleared: 'Comanda limpa.',
          enterItemName: 'Informe o nome do item.',
          enterValidItemPrice: 'Informe um preco valido para o item.',
          itemAddedToCatalog: 'Item adicionado ao catalogo: {nome}.',
          defaultMethodUpdated: 'Forma padrao atualizada para {forma}.'
        }
      },
      dashboardPage: {
        cards: {
          overdue: 'Atrasado',
          remaining: 'Restante',
          received: 'Recebido'
        },
        buttons: {
          newRegister: 'Novo cadastro'
        },
        search: {
          placeholder: 'Buscar por nome ou situacao (devendo, a pagar, pagos...)'
        },
        tabs: {
          all: 'Todos',
          overdue: 'Devendo',
          pending: 'A pagar',
          paid: 'Pagos',
          installment: 'Parcelados'
        },
        clientAmounts: {
          paid: 'Pago',
          remaining: 'Falta',
          total: 'Total'
        },
        modals: {
          create: {
            title: 'Novo lancamento',
            namePlaceholder: 'Nome do cliente',
            whatsappPlaceholder: 'WhatsApp',
            totalValuePlaceholder: 'Valor total',
            repeatOnce: 'Unica',
            repeat4: '4x semanal',
            repeat8: '8x semanal',
            repeat12: '12x semanal',
            submit: 'Cadastrar'
          },
          edit: {
            title: 'Editar lancamento',
            labelName: 'Nome',
            labelWhatsapp: 'WhatsApp',
            whatsappPlaceholder: 'Numero com DDD',
            labelTotal: 'Total',
            labelPaid: 'Pago',
            labelDate: 'Data',
            submit: 'Atualizar dados'
          },
          whatsapp: {
            sendMessageTitle: 'Enviar mensagem',
            customerFallbackName: 'Cliente',
            messageFor: 'Mensagem para {nome}',
            generatingMpLink: 'Gerando link Mercado Pago...',
            options: {
              dueDateTitle: 'Dia do vencimento',
              dueDateText: 'Bom dia {nome}. Hoje e o dia da mensalidade no valor de {valor}.',
              openReminderTitle: 'Lembrete em aberto',
              openReminderText: 'Bom dia. Percebemos que a mensalidade esta em aberto. Se precisar conversar, estou a disposicao.',
              negotiationTitle: 'Negociacao',
              negotiationText: 'Bom dia. Sobre a mensalidade em aberto, podemos negociar a melhor forma de pagamento.',
              newDueDateTitle: 'Novo vencimento',
              newDueDateText: 'Boa tarde. Conforme combinado, atualizamos o vencimento da mensalidade.',
              nextMonthDueDateText: 'Conforme combinado, atualizamos o vencimento para o proximo mes.',
              mpPixQrTitle: 'PIX instantaneo (QR + copia e cola)',
              mpPixQrText: 'Gerar PIX nativo com QR e codigo copia e cola de {valor}.',
              mpQrTitle: 'Checkout Mercado Pago (QR do link)',
              mpQrText: 'Gerar QR do link de checkout de {valor} para exibir na tela.',
              mpLinkTitle: 'Link Mercado Pago',
              mpLinkText: 'Gerar e enviar link de pagamento de {valor}.',
              remainingBalanceTitle: 'Saldo restante',
              remainingBalanceText: 'Recebi o valor parcial de {valorPago}. O saldo restante e {saldo}.',
              thankPaymentTitle: 'Agradecer pagamento',
              thankPaymentText: 'Recebi seu pagamento de {valor}. Obrigado.'
            }
          },
          qrPayment: {
            title: 'QR Code de pagamento',
            subtitle: 'Use este QR para abrir o checkout do Mercado Pago no celular.',
            close: 'Fechar',
            generating: 'Gerando QR Code de pagamento...',
            customerLabel: 'Cliente',
            amountLabel: 'Valor',
            statusTitle: 'Status do pagamento',
            statusPreparing: 'Gerando PIX e iniciando acompanhamento de status...',
            statusChecking: 'Consultando status do pagamento...',
            statusAwaiting: 'Aguardando',
            statusUpdatedAt: 'Atualizado as {hora}',
            statusPaymentId: 'Pagamento #{id}',
            statusApproved: 'Aprovado',
            statusPending: 'Pendente',
            statusInProcess: 'Em processamento',
            statusAuthorized: 'Autorizado',
            statusRejected: 'Recusado',
            statusCancelled: 'Cancelado',
            statusExpired: 'Expirado',
            statusRefunded: 'Estornado',
            statusChargedBack: 'Chargeback',
            statusUnknown: 'Status desconhecido',
            statusError: 'Erro na consulta',
            statusPollError: 'Nao foi possivel atualizar o status agora. Tentando novamente...',
            noData: 'Nenhum QR gerado ainda.',
            imageAlt: 'QR Code de pagamento Mercado Pago',
            copyFieldLinkLabel: 'Link de pagamento',
            copyFieldPixLabel: 'Codigo PIX copia e cola',
            copyLink: 'Copiar link',
            copyPixCode: 'Copiar codigo PIX',
            openCheckout: 'Abrir checkout',
            openTicket: 'Abrir comprovante/checkout',
            pixTitle: 'PIX copia e cola (Mercado Pago)',
            pixSubtitle: 'Mostre o QR EMV ou copie o codigo PIX para pagamento imediato.',
            linkCopiedTitle: 'Link copiado',
            linkCopiedMessage: 'O link de pagamento foi copiado para a area de transferencia.',
            pixCopiedTitle: 'Codigo PIX copiado',
            pixCopiedMessage: 'O codigo PIX foi copiado para a area de transferencia.',
            noPendingBalance: 'Nao ha saldo pendente para gerar PIX.',
            serverUnavailable: 'Servidor de pagamento indisponivel. Inicie o server.js para usar PIX Mercado Pago.',
            missingQrData: 'Resposta sem dados de QR PIX.',
            generateError: 'Nao foi possivel gerar o QR Code.',
            generateErrorWithDetail: 'Nao foi possivel gerar o QR Code do Mercado Pago.\n{detalhe}'
          }
        },
        notifications: {
          openAria: 'Abrir notificacoes de pagamentos',
          countAria: 'Notificacoes de pagamentos: {total}',
          titleToday: 'Pagamentos de hoje',
          titleOverdue: 'Vencidas',
          toggleViewOverdue: 'Ver vencidas',
          toggleBackToday: 'Voltar para pagamentos de hoje',
          emptyToday: 'Nenhum pagamento para hoje.',
          emptyOverdue: 'Nenhuma cobranca vencida.',
          dueToday: 'Vence hoje',
          overdueSince: 'Venceu em',
          entriesCount: '{q} lancamentos',
          completed: {
            close: 'Fechar notificacao',
            title: 'Pagamento concluido',
            message: '{nome} recebeu {valor}{forma}.',
            methodSuffix: ' via {forma}',
            sourceManual: 'via marcacao manual',
            sourceEdit: 'via ajuste manual',
            sourceMercadoPago: 'via Mercado Pago',
            browserTitle: 'Pagamento concluido',
            browserEnabledTitle: 'Notificacoes ativadas',
            browserEnabledMessage: 'O navegador agora pode avisar quando um pagamento for concluido.'
          }
        }
      },
      auth: {
        messages: {
          enterUserPass: 'Informe usuario e senha.',
          noUsers: 'Nenhum usuario cadastrado.',
          invalidCredentials: 'Usuario ou senha invalidos.',
          alreadyHasUser: 'Ja existe usuario cadastrado.',
          minUser: 'Use um nome com pelo menos 3 caracteres.',
          minPass: 'Use uma senha com pelo menos 4 caracteres.',
          onlyOwnerManage: 'Apenas o proprietario pode gerenciar usuarios.',
          onlyOwnerRemove: 'Apenas o proprietario pode remover usuarios.',
          invalidUser: 'Usuario invalido.',
          cannotRemoveLast: 'Nao e possivel remover o ultimo usuario.',
          userNotFound: 'Usuario nao encontrado.',
          cannotRemoveOwner: 'Nao e permitido remover o proprietario.',
          cannotRemoveSelf: 'Nao e permitido remover seu proprio usuario.',
          noUsersRegistered: 'Nenhum usuario cadastrado.',
          helpOwnerOnly: 'Somente o proprietario pode cadastrar, alterar senha e remover usuarios.',
          saveUser: 'Salvar usuario',
          usersAndPasswords: 'Usuarios e senhas',
          userNamePlaceholder: 'Nome do usuario',
          passwordPlaceholder: 'Senha',
          passwordUpdated: 'Senha atualizada com sucesso.',
          userCreated: 'Usuario cadastrado com sucesso.',
          removeUserConfirm: 'Deseja remover este usuario?',
          userRemoved: 'Usuario removido com sucesso.',
          manageUsersTitle: 'Gerenciar usuarios e senhas',
          logoutConfirm: 'Deseja sair da conta atual?',
          logoutButton: 'Sair da conta'
        },
        labels: {
          owner: 'Proprietario',
          developer: 'Desenvolvedor',
          user: 'Usuario',
          activeSession: 'Sessao ativa'
        }
      },
      script: {
        alerts: {
          fillFields: 'Preencha todos os campos.',
          reversalDone: 'Estorno realizado: {valor} removido da carteira.',
          invalidValue: 'Valor invalido.',
          insufficientMonthlyBalance: 'Saldo insuficiente no mes selecionado.',
          invalidWalletTransferValue: 'Informe um valor valido no campo da Carteira para transferir.',
          insufficientWalletMonth: 'Saldo insuficiente na Carteira para o mes selecionado.',
          invalidSavingsWithdrawValue: 'Informe um valor valido no campo da Poupanca para resgatar.',
          insufficientSavingsMonth: 'Saldo insuficiente na Poupanca para o mes selecionado.',
          noPhoneLinkCopied: 'Cliente sem telefone valido. Link copiado para a area de transferencia.',
          noPhoneLinkOpened: 'Cliente sem telefone valido. Link aberto em nova aba.',
          cannotGenerateMpLink: 'Nao foi possivel gerar o link do Mercado Pago.\\n{detalhe}',
          noPhoneRegistered: 'Cliente sem telefone cadastrado.',
          invalidWhatsappPhone: 'Telefone invalido para WhatsApp.'
        },
        confirms: {
          deleteTransaction: 'Excluir este lancamento?'
        }
      }
    },
    'en-US': {
      common: {
        remove: 'Remove',
        edit: 'Edit',
        save: 'Save',
        saveItem: 'Save item',
        clear: 'Clear',
        export: 'Export',
        exclude: 'Delete',
        menuPage: 'Menu',
        openAppMenu: 'Open app menu'
      },
      pwa: {
        ui: {
          installAria: 'Install application',
          installButton: 'Install app',
          closeModalAria: 'Close notice'
        },
        logs: {
          localhostSwRemoved: 'Service Workers removed on localhost to avoid cache during development.',
          notSupported: 'Service Worker is not supported in this browser.',
          insecureContext: 'Insecure context; SW not registered.',
          localhostDisabled: 'SW disabled on localhost. Use ?pwa-sw=1 or localStorage[\"{key}\"]=\"1\" to test.',
          installPromptOpenFail: 'Failed to open install prompt:',
          installPromptResult: 'Install prompt result:',
          unknown: 'unknown',
          beforeInstallPrompt: 'beforeinstallprompt received.',
          appInstalled: 'App installed.'
        },
        install: {
          failTitle: 'Installation failed',
          failMessage: 'Could not open the install prompt right now.',
          startedTitle: 'Installation started',
          startedMessage: 'The browser will complete app installation.',
          cancelledTitle: 'Installation cancelled',
          cancelledMessage: 'You can try again when the browser allows a new prompt.',
          availableTitle: 'App can be installed',
          availableMessage: 'You can now install Finances on this device.',
          doneTitle: 'App installed',
          doneMessage: 'Finances can now open in standalone mode.'
        },
        update: {
          title: 'New version available',
          message: 'An app update has been downloaded. Update now?',
          confirm: 'Update',
          later: 'Later'
        }
      },
      menu: {
        userGeneric: 'User',
        developer: 'Developer',
        patchNotes: {
          button: 'Patch notes',
          buttonAria: 'Open patch notes',
          kicker: 'Patch notes',
          title: 'Update history',
          subtitle: 'Check the release date and time of each version and what was changed.',
          empty: 'No updates registered yet.',
          close: 'Close patch notes',
          latestBadge: 'Latest',
          changesLabel: 'What changed',
          noDetails: 'No details for this version.',
          versionLabel: 'Version {versao}',
          releasedAt: 'Released at {data}',
          entryTitleFallback: 'Update',
          devToolsTitle: 'Dev tools',
          new: 'New patch',
          exportJson: 'Export JSON',
          importJson: 'Import JSON',
          edit: 'Edit',
          delete: 'Delete',
          save: 'Save patch',
          cancel: 'Cancel',
          labelVersion: 'Version',
          labelDateTime: 'Date and time',
          labelTitlePt: 'Title (PT-BR)',
          labelTitleEn: 'Title (EN-US)',
          labelChangesPt: 'Changes (PT-BR)',
          labelChangesEn: 'Changes (EN-US)',
          placeholderVersion: '2026.02.25-01',
          placeholderTitlePt: 'Titulo em portugues',
          placeholderTitleEn: 'Title in English',
          placeholderChanges: 'One change per line',
          editorHint: 'Use one line per change item.',
          saved: 'Patch note saved successfully.',
          deleted: 'Patch note removed.',
          exportDone: 'Patch notes exported to JSON.',
          importDone: 'Patch notes imported successfully.',
          importInvalid: 'Invalid patch notes JSON.',
          importReadError: 'Could not read the JSON file.',
          deleteConfirm: 'Delete this patch note?',
          validation: {
            versionRequired: 'Enter the patch version.',
            dateRequired: 'Enter the release date and time.',
            titleRequired: 'Enter at least one title (PT-BR or EN-US).',
            invalidDate: 'Invalid date/time.',
            invalidEntry: 'Could not save this patch.'
          }
        },
        groups: {
          operacao: { title: 'Financial operations', description: 'Daily flow of clients, income, expenses and cash.' },
          relatorios: { title: 'Reports and analytics', description: 'Yearly consolidated views and period comparisons.' },
          acesso: { title: 'Access and account', description: 'Authentication and sign-in pages.' },
          sistema: { title: 'System and support', description: 'PWA helper pages and application fallback.' }
        },
        pages: {
          dashboard: { title: 'Financial dashboard', description: 'Main screen with clients, payments and quick actions.' },
          economias: { title: 'Savings', description: 'Wallet, statement, savings and balance control.' },
          despesas: { title: 'Expenses', description: 'Expense entries and monthly expense control.' },
          comercio: { title: 'Commerce mode', description: 'Orders, daily sales, catalog and consolidated statement.' },
          resumoAno: { title: 'Annual summary', description: 'Annual executive summary with charts and consolidated totals.' },
          resumoEconomias: { title: 'Savings summary', description: 'Wallet and savings evolution with monthly analysis.' },
          login: { title: 'Login', description: 'System access screen with username and password.' },
          offline: { title: 'Offline (PWA fallback)', description: 'Page shown when the app is offline.' },
          devTools: { title: 'Dev Tools', description: 'Internal tools for diagnostics, simulation and app maintenance.' }
        },
        tags: {
          principal: 'Main',
          protegida: 'Protected',
          carteira: 'Wallet',
          mensal: 'Monthly',
          vendas: 'Sales',
          executivo: 'Executive',
          evolucao: 'Trend',
          publica: 'Public',
          autenticacao: 'Auth',
          interna: 'Internal',
          pwa: 'PWA',
          dev: 'DEV'
        }
      },
      resumoEconomias: {
        mainTitle: 'Savings summary',
        cards: {
          totalReceived12m: 'Total received (12 months)',
          totalExpenses12m: 'Total expenses (12 months)',
          currentWallet: 'Current wallet balance',
          currentSavings: 'Current savings balance'
        },
        chart: {
          title: 'Available x savings by month',
          available: 'Available',
          savings: 'Savings'
        },
        table: {
          headers: {
            month: 'Month',
            available: 'Available',
            savings: 'Savings',
            savingsAccum: 'Savings accumulated'
          }
        },
        methods: {
          title: 'Receipts by payment method',
          subtitle: 'See how much was received by method and track month-by-month values.',
          selectLabel: 'Select method',
          selectAria: 'Select payment method in savings summary',
          all: 'All methods',
          receivedInMethod: 'Received in method'
        }
      },
      economias: {
        pageTitle: 'Statement',
        subtitle: 'Track wallet and savings movements in a simple dashboard.',
        tabs: {
          wallet: 'Wallet',
          savings: 'Savings'
        },
        forms: {
          walletDescriptionPlaceholder: 'Description (Ex: Trip)',
          savingsDescriptionPlaceholder: 'Description (Ex: Save for car)'
        },
        actions: {
          in: 'Money in',
          out: 'Money out',
          transferToSavings: 'Transfer to savings',
          save: 'Save',
          withdraw: 'Withdraw',
          sendToWallet: 'Send to wallet'
        },
        monthMenu: {
          openYearSummary: 'Open annual summary for {ano}'
        },
        wallet: {
          monthBalance: 'Month balance ({mes})',
          availableBalance: 'Available balance (wallet)'
        },
        savings: {
          monthBalance: 'Savings this month ({mes})',
          totalInvested: 'Total invested (savings)'
        },
        extrato: {
          walletTitle: 'Wallet statement',
          savingsTitle: 'Savings history',
          filterLabel: 'Method',
          filterAria: 'Filter statement by payment method',
          emptyMonth: 'No transactions in {mes}.',
          filter: {
            all: 'All',
            withMethod: 'With identified method',
            withoutMethod: 'Without identification'
          },
          details: {
            type: 'Type',
            category: 'Category',
            paymentMethod: 'Payment method',
            value: 'Value',
            datetime: 'Date/Time',
            typeIn: 'In',
            typeOut: 'Out',
            noCategory: 'No category',
            notInformed: 'Not informed'
          },
          descriptions: {
            received: 'Received',
            reversal: 'Reversal',
            manualAdjustment: 'Manual adjustment',
            manualCorrection: 'Manual correction',
            expenseCreatedPaid: 'Expense created as paid',
            expensePayment: 'Expense payment',
            expenseReversal: 'Expense reversal',
            expenseAdjustmentReversal: 'Expense adjustment reversal',
            recurringAdjustmentReversal: 'Recurring adjustment reversal',
            paidRecurringAdjustment: 'Paid recurring adjustment',
            commerceMode: 'Commerce mode',
            savingsWithdrawalToWallet: 'Savings withdrawal',
            transferToSavings: 'Transfer to savings',
            comingFromWallet: 'From wallet',
            sentToWallet: 'Sent to wallet',
            savingsInvestment: 'Investment',
            savingsRedeem: 'Withdrawal'
          }
        }
      },
      despesas: {
        mainTitle: 'Fixed Expenses and Bills',
        subtitle: 'Track pending bills, payments and period totals in a simple dashboard.',
        cards: { toPay: 'Total to pay', paid: 'Total paid', total: 'Grand total' },
        buttons: { newExpense: 'New expense', save: 'Save' },
        tabs: { all: 'All', pending: 'Pending', paid: 'Paid', overdue: 'Overdue' },
        modal: {
          createTitle: 'Create bill',
          editTitle: 'Edit bill',
          namePlaceholder: 'Bill name',
          valuePlaceholder: 'Amount',
          statusPending: 'Pending',
          statusPaid: 'Paid',
          recurringMonthly: 'Monthly recurring'
        },
        menu: {
          expandMonths: 'Expand months',
          collapseMonths: 'Collapse months',
          currentMonth: 'Current month'
        },
        notifications: {
          alerts: 'Expense alerts',
          overdue: 'Overdue',
          dueToday: 'Due today',
          dueTomorrow: 'Due tomorrow',
          overdueOn: 'Overdue on',
          dueTodaySingle: 'Due today',
          dueTomorrowSingle: 'Due tomorrow'
        },
        alerts: {
          fillFields: 'Fill in all fields',
          notFound: 'Expense not found'
        }
      },
      comercioPage: {
        meta: {
          title: 'Commerce mode | Finances'
        },
        common: {
          ticketAverage: 'Average ticket: {valor}',
          edit: 'Edit',
          save: 'Save',
          saveItem: 'Save item',
          clear: 'Clear',
          export: 'Export',
          exclude: 'Delete'
        },
        paymentMethods: {
          notInformed: 'Not informed',
          pix: 'PIX',
          cash: 'Cash',
          debit: 'Debit',
          credit: 'Credit',
          transfer: 'Transfer',
          boleto: 'Boleto'
        },
        units: {
          sales: '{q} sale(s)',
          items: '{q} item(s)',
          unitsShort: '{q} u.',
          days: '{q} day(s)'
        },
        statuses: {
          exported: 'Exported',
          pending: 'Pending'
        },
        periods: {
          today: 'Today',
          last7Days: 'Last 7 days',
          last15Days: 'Last 15 days',
          last30Days: 'Last 30 days'
        },
        filters: {
          allMethods: 'All methods',
          noMethod: 'No method informed'
        },
        dialogs: {
          close: 'Close',
          cancel: 'Cancel',
          confirmTitle: 'Confirm',
          confirmationTitle: 'Confirmation',
          confirm: 'Confirm',
          exportToStatementTitle: 'Export to statement',
          exportToStatementMessage: 'Export {vendas} to the statement?\nTotal: {total}',
          removeSaleTitle: 'Remove sale',
          removeSaleMessage: 'Remove this sale from today\'s list?',
          removeExportedSaleMessage: 'This record was already exported. Remove only from the day list?',
          clearExportedTitle: 'Clear exported',
          clearExportedMessage: 'Remove all exported records from the day list?',
          clearOrderTitle: 'Clear order',
          clearOrderMessage: 'Clear the current order?',
          removeCatalogItemTitle: 'Remove item',
          removeCatalogItemMessage: 'Remove item \"{nome}\" from catalog?'
        },
        header: {
          kicker: 'Commerce mode',
          title: 'Sales center',
          subtitle: 'Build an order with multiple items, apply discount/increase and manually export to the wallet statement.',
          buttons: {
            economias: 'Savings'
          }
        },
        summary: {
          aria: 'Daily sales summary',
          cards: {
            totalDay: 'Day total',
            pendingExport: 'Pending export',
            itemsSoldToday: 'Items sold today',
            date: 'Date'
          }
        },
        reports: {
          aria: 'Daily and weekly reports',
          title: 'Reports',
          subtitle: 'Daily and weekly summary with totals, pending amounts and payment methods.',
          detailPeriod: 'Detail period',
          paymentMethodsTitle: 'Payment methods • {periodo}',
          noSalesSelectedPeriod: 'No sales in the selected period.',
          cards: {
            todayTotal: 'Today • Total',
            todayPending: 'Today • Pending',
            weekTotal: '7 days • Total',
            weekPending: '7 days • Pending'
          }
        },
        panel: {
          aria: 'Quick settings'
        },
        catalog: {
          addButton: 'Add to catalog',
          newItemTitle: 'New item',
          newItemSubtitle: 'Register name, price and optional cost.',
          closeItemFormAria: 'Close item form',
          placeholders: {
            name: 'Ex.: Water 500ml',
            price: 'Price (ex.: 5.00)',
            cost: 'Cost (optional)'
          },
          sectionTitle: 'Items (cards)',
          sectionSubtitle: 'Tap cards to add to the current order.',
          searchLabel: 'Search product',
          searchPlaceholder: 'Type item name',
          clearSearch: 'Clear search',
          empty: 'No items in the catalog.',
          notFound: 'No products found for \"{termo}\".',
          costLabel: 'Cost: {valor}',
          addToOrder: 'Add to order',
          editItemTitle: 'Edit item',
          editItemMessage: 'Update item name, price and cost.',
          itemNameLabel: 'Item name',
          priceLabel: 'Price (R$)',
          costOptionalLabel: 'Cost (R$) - optional'
        },
        order: {
          aria: 'Current order',
          title: 'Current order',
          emptyHint: 'Build the order by tapping items above.',
          empty: 'The order is empty.',
          clear: 'Clear order',
          finishSale: 'Finish sale',
          identificationOptional: 'Identification (optional)',
          identificationPlaceholder: 'Ex.: Table 3 / Customer John',
          paymentMethod: 'Payment method',
          discount: 'Discount (R$)',
          increase: 'Increase (R$)',
          summaryShort: '{itens} • {total} • {forma}',
          summaryFull: '{itens} | {total} | cost {custo} | profit {lucro} | {forma}',
          eachPrice: '{valor} each',
          costInline: 'cost {valor}',
          totalMustBePositive: 'Final total must be greater than zero.',
          totals: {
            subtotal: 'Subtotal',
            discount: 'Discount',
            increase: 'Increase',
            finalTotal: 'Final total'
          }
        },
        tabs: {
          aria: 'Sales and statement tabs',
          switchAria: 'Switch between sales, statement and item report',
          salesDay: 'Daily sales list',
          statement: 'Commerce statement',
          itemsReport: 'Items report'
        },
        sales: {
          listTitle: 'Daily sales list',
          clearExported: 'Clear exported',
          fallbackSale: 'Sale',
          discountShort: 'Disc. {valor}',
          increaseShort: 'Add. {valor}',
          subtotalLabel: 'Subtotal: {valor}',
          daySummary: '{vendas} today • {pendente} pending export.',
          noneLaunchedYet: 'No sales launched yet.',
          noneMatchFilter: 'No sales match the selected filter.',
          noneToday: 'No sales registered today.',
          useTemplate: 'Use template'
        },
        statement: {
          aria: 'Commerce statement',
          title: 'Commerce statement',
          subtitle: 'Consolidated history of commerce sales, with estimated cost and profit.',
          exportButton: 'Export to statement',
          recordsCount: '{q} record(s){sufixo}',
          last120Suffix: ' (last 120)',
          empty: 'No consolidated exports recorded in the commerce statement yet.',
          batchExportTitle: 'Consolidated export - {data}',
          profitLabel: 'Profit: {valor}',
          noBatchSummary: 'No sales summary for this batch',
          modePrefix: 'Commerce mode',
          exportToWalletDescription: 'Commerce mode: Consolidated export ({vendas}, {itens})',
          cards: {
            revenue: 'Revenue',
            cost: 'Cost',
            profit: 'Estimated profit',
            exportedPending: 'Exported / Pending'
          },
          totals: {
            sales: 'Sales',
            items: 'Items',
            revenue: 'Revenue',
            cost: 'Cost',
            profit: 'Profit'
          }
        },
        itemsReport: {
          aria: 'Items report',
          title: 'Items report',
          subtitle: 'Item performance based on commerce sales.',
          periodLabel: 'Period',
          noData: 'Not enough data in this period.',
          unitsInPeriod: '{q} u. in period',
          genericItem: 'Item',
          cards: {
            topSold: 'Top selling item',
            topProfit: 'Most profitable item',
            topRevenue: 'Highest revenue',
            itemsWithSales: 'Items with sales'
          },
          blocks: {
            rankQty: 'Ranking by quantity',
            top5: 'Top 5',
            rankProfit: 'Ranking by profit',
            lowTurnover: 'Low turnover items',
            lowestOutput: 'Lowest output',
            periodSummary: 'Period summary',
            revenueVsCost: 'Revenue x cost'
          },
          summary: {
            totalRevenue: 'Total revenue',
            totalCost: 'Total cost',
            estimatedProfit: 'Estimated profit',
            ticketPerSale: 'Average ticket per sale',
            lowTurnoverItems: 'Low turnover items (<= 2 u.)',
            itemsWithoutSales: 'Catalog items without sales'
          }
        },
        feedback: {
          itemAddedToOrder: 'Item added to order: {nome}.',
          saleRecorded: 'Sale recorded ({valor}).',
          noPendingSalesToExport: 'No pending sales to export.',
          exportDoneSingleEntry: 'Export completed: {vendas} consolidated into 1 statement entry.',
          saleRemovedFromDayList: 'Record removed from the day list.',
          saleLoadedAsTemplate: 'Sale loaded as order template.',
          noExportedRecordsToClear: 'No exported records to clear.',
          exportedRecordsCleared: 'Exported records removed from the list.',
          itemNameRequired: 'Item name cannot be empty.',
          invalidPrice: 'Invalid price.',
          itemUpdated: 'Item updated: {nome}.',
          itemRemovedFromCatalog: 'Item removed from catalog: {nome}.',
          orderAlreadyEmpty: 'The order is already empty.',
          orderCleared: 'Order cleared.',
          enterItemName: 'Enter the item name.',
          enterValidItemPrice: 'Enter a valid item price.',
          itemAddedToCatalog: 'Item added to catalog: {nome}.',
          defaultMethodUpdated: 'Default method updated to {forma}.'
        }
      },
      dashboardPage: {
        cards: {
          overdue: 'Overdue',
          remaining: 'Remaining',
          received: 'Received'
        },
        buttons: {
          newRegister: 'New record'
        },
        search: {
          placeholder: 'Search by name or status (overdue, pending, paid...)'
        },
        tabs: {
          all: 'All',
          overdue: 'Overdue',
          pending: 'Pending',
          paid: 'Paid',
          installment: 'Installments'
        },
        clientAmounts: {
          paid: 'Paid',
          remaining: 'Remaining',
          total: 'Total'
        },
        modals: {
          create: {
            title: 'New entry',
            namePlaceholder: 'Client name',
            whatsappPlaceholder: 'WhatsApp',
            totalValuePlaceholder: 'Total amount',
            repeatOnce: 'One-time',
            repeat4: '4x weekly',
            repeat8: '8x weekly',
            repeat12: '12x weekly',
            submit: 'Create'
          },
          edit: {
            title: 'Edit entry',
            labelName: 'Name',
            labelWhatsapp: 'WhatsApp',
            whatsappPlaceholder: 'Number with area code',
            labelTotal: 'Total',
            labelPaid: 'Paid',
            labelDate: 'Date',
            submit: 'Update data'
          },
          whatsapp: {
            sendMessageTitle: 'Send message',
            customerFallbackName: 'Customer',
            messageFor: 'Message to {nome}',
            generatingMpLink: 'Generating Mercado Pago link...',
            options: {
              dueDateTitle: 'Due date',
              dueDateText: 'Good morning {nome}. Today is the membership due date in the amount of {valor}.',
              openReminderTitle: 'Open reminder',
              openReminderText: 'Good morning. We noticed the membership payment is still open. If you need to talk, I am available.',
              negotiationTitle: 'Negotiation',
              negotiationText: 'Good morning. Regarding the open membership payment, we can negotiate the best payment method.',
              newDueDateTitle: 'New due date',
              newDueDateText: 'Good afternoon. As agreed, we updated the membership due date.',
              nextMonthDueDateText: 'As agreed, we updated the due date to next month.',
              mpPixQrTitle: 'Instant PIX (QR + copy/paste)',
              mpPixQrText: 'Generate a native PIX QR and copy/paste code for {valor}.',
              mpQrTitle: 'Mercado Pago checkout (link QR)',
              mpQrText: 'Generate a checkout link QR for {valor} to display on screen.',
              mpLinkTitle: 'Mercado Pago link',
              mpLinkText: 'Generate and send a payment link for {valor}.',
              remainingBalanceTitle: 'Remaining balance',
              remainingBalanceText: 'I received the partial amount of {valorPago}. The remaining balance is {saldo}.',
              thankPaymentTitle: 'Thank for payment',
              thankPaymentText: 'I received your payment of {valor}. Thank you.'
            }
          },
          qrPayment: {
            title: 'Payment QR code',
            subtitle: 'Use this QR to open Mercado Pago checkout on a phone.',
            close: 'Close',
            generating: 'Generating payment QR code...',
            customerLabel: 'Customer',
            amountLabel: 'Amount',
            statusTitle: 'Payment status',
            statusPreparing: 'Generating PIX and starting status tracking...',
            statusChecking: 'Checking payment status...',
            statusAwaiting: 'Waiting',
            statusUpdatedAt: 'Updated at {hora}',
            statusPaymentId: 'Payment #{id}',
            statusApproved: 'Approved',
            statusPending: 'Pending',
            statusInProcess: 'Processing',
            statusAuthorized: 'Authorized',
            statusRejected: 'Rejected',
            statusCancelled: 'Cancelled',
            statusExpired: 'Expired',
            statusRefunded: 'Refunded',
            statusChargedBack: 'Chargeback',
            statusUnknown: 'Unknown status',
            statusError: 'Check error',
            statusPollError: 'Could not refresh status right now. Retrying...',
            noData: 'No QR code generated yet.',
            imageAlt: 'Mercado Pago payment QR code',
            copyFieldLinkLabel: 'Payment link',
            copyFieldPixLabel: 'PIX copy/paste code',
            copyLink: 'Copy link',
            copyPixCode: 'Copy PIX code',
            openCheckout: 'Open checkout',
            openTicket: 'Open receipt/checkout',
            pixTitle: 'PIX copy/paste (Mercado Pago)',
            pixSubtitle: 'Show the EMV QR or copy the PIX code for immediate payment.',
            linkCopiedTitle: 'Link copied',
            linkCopiedMessage: 'The payment link was copied to the clipboard.',
            pixCopiedTitle: 'PIX code copied',
            pixCopiedMessage: 'The PIX code was copied to the clipboard.',
            noPendingBalance: 'There is no pending balance to generate PIX.',
            serverUnavailable: 'Payment server unavailable. Start server.js to use Mercado Pago PIX.',
            missingQrData: 'Response without PIX QR data.',
            generateError: 'Could not generate the QR code.',
            generateErrorWithDetail: 'Could not generate the Mercado Pago QR code.\n{detalhe}'
          }
        },
        notifications: {
          openAria: 'Open payment notifications',
          countAria: 'Payment notifications: {total}',
          titleToday: 'Today\'s payments',
          titleOverdue: 'Overdue',
          toggleViewOverdue: 'View overdue',
          toggleBackToday: 'Back to today\'s payments',
          emptyToday: 'No payments for today.',
          emptyOverdue: 'No overdue charges.',
          dueToday: 'Due today',
          overdueSince: 'Overdue since',
          entriesCount: '{q} entries',
          completed: {
            close: 'Close notification',
            title: 'Payment completed',
            message: '{nome} received {valor}{forma}.',
            methodSuffix: ' via {forma}',
            sourceManual: 'manual check action',
            sourceEdit: 'manual adjustment',
            sourceMercadoPago: 'via Mercado Pago',
            browserTitle: 'Payment completed',
            browserEnabledTitle: 'Notifications enabled',
            browserEnabledMessage: 'The browser can now notify you when a payment is completed.'
          }
        }
      },
      auth: {
        messages: {
          enterUserPass: 'Enter username and password.',
          noUsers: 'No users registered.',
          invalidCredentials: 'Invalid username or password.',
          alreadyHasUser: 'A user is already registered.',
          minUser: 'Use a name with at least 3 characters.',
          minPass: 'Use a password with at least 4 characters.',
          onlyOwnerManage: 'Only the owner can manage users.',
          onlyOwnerRemove: 'Only the owner can remove users.',
          invalidUser: 'Invalid user.',
          cannotRemoveLast: 'Cannot remove the last user.',
          userNotFound: 'User not found.',
          cannotRemoveOwner: 'Cannot remove the owner.',
          cannotRemoveSelf: 'Cannot remove your own user.',
          noUsersRegistered: 'No users registered.',
          helpOwnerOnly: 'Only the owner can create users, change passwords and remove users.',
          saveUser: 'Save user',
          usersAndPasswords: 'Users and passwords',
          userNamePlaceholder: 'User name',
          passwordPlaceholder: 'Password',
          passwordUpdated: 'Password updated successfully.',
          userCreated: 'User created successfully.',
          removeUserConfirm: 'Remove this user?',
          userRemoved: 'User removed successfully.',
          manageUsersTitle: 'Manage users and passwords',
          logoutConfirm: 'Sign out of the current account?',
          logoutButton: 'Sign out'
        },
        labels: {
          owner: 'Owner',
          developer: 'Developer',
          user: 'User',
          activeSession: 'Active session'
        }
      },
      script: {
        alerts: {
          fillFields: 'Fill in all fields.',
          reversalDone: 'Reversal completed: {valor} removed from wallet.',
          invalidValue: 'Invalid value.',
          insufficientMonthlyBalance: 'Insufficient balance for the selected month.',
          invalidWalletTransferValue: 'Enter a valid amount in the Wallet field to transfer.',
          insufficientWalletMonth: 'Insufficient Wallet balance for the selected month.',
          invalidSavingsWithdrawValue: 'Enter a valid amount in the Savings field to withdraw.',
          insufficientSavingsMonth: 'Insufficient Savings balance for the selected month.',
          noPhoneLinkCopied: 'Client has no valid phone. Link copied to clipboard.',
          noPhoneLinkOpened: 'Client has no valid phone. Link opened in a new tab.',
          cannotGenerateMpLink: 'Could not generate the Mercado Pago link.\\n{detalhe}',
          noPhoneRegistered: 'Client has no registered phone.',
          invalidWhatsappPhone: 'Invalid WhatsApp phone.'
        },
        confirms: {
          deleteTransaction: 'Delete this transaction?'
        }
      }
    }
  };

  var extraSelectorMap = [
    { path: '/index.html', selector: '.dashboard .card:nth-child(1) h3', key: 'dashboardPage.cards.overdue' },
    { path: '/index.html', selector: '.dashboard .card:nth-child(2) h3', key: 'dashboardPage.cards.remaining' },
    { path: '/index.html', selector: '.dashboard .card:nth-child(3) h3', key: 'dashboardPage.cards.received' },
    { path: '/index.html', selector: '#btn-abrir-cadastro .btn-text', key: 'dashboardPage.buttons.newRegister' },
    { path: '/index.html', selector: '#buscaNome', attr: 'placeholder', key: 'dashboardPage.search.placeholder' },
    { path: '/index.html', selector: '.tabs .tab-btn:nth-child(1)', key: 'dashboardPage.tabs.all' },
    { path: '/index.html', selector: '.tabs .tab-btn:nth-child(2)', key: 'dashboardPage.tabs.overdue' },
    { path: '/index.html', selector: '.tabs .tab-btn:nth-child(3)', key: 'dashboardPage.tabs.pending' },
    { path: '/index.html', selector: '.tabs .tab-btn:nth-child(4)', key: 'dashboardPage.tabs.paid' },
    { path: '/index.html', selector: '.tabs .tab-btn:nth-child(5)', key: 'dashboardPage.tabs.installment' },
    { path: '/index.html', selector: '#btn-notificacoes-hoje', attr: 'aria-label', key: 'dashboardPage.notifications.openAria' },
    { path: '/index.html', selector: '#notificacoes-hoje-titulo', key: 'dashboardPage.notifications.titleToday' },
    { path: '/index.html', selector: '#btn-notificacoes-hoje-alternar', attr: 'aria-label', key: 'dashboardPage.notifications.toggleViewOverdue' },
    { path: '/index.html', selector: '#btn-notificacoes-hoje-alternar', attr: 'title', key: 'dashboardPage.notifications.toggleViewOverdue' },
    { path: '/index.html', selector: '#whats-titulo', key: 'dashboardPage.modals.whatsapp.sendMessageTitle' },
    { path: '/index.html', selector: '#container-cadastro h3', key: 'dashboardPage.modals.create.title' },
    { path: '/index.html', selector: '#nome', attr: 'placeholder', key: 'dashboardPage.modals.create.namePlaceholder' },
    { path: '/index.html', selector: '#telefone', attr: 'placeholder', key: 'dashboardPage.modals.create.whatsappPlaceholder' },
    { path: '/index.html', selector: '#valor', attr: 'placeholder', key: 'dashboardPage.modals.create.totalValuePlaceholder' },
    { path: '/index.html', selector: '#repetir option[value=\"1\"]', key: 'dashboardPage.modals.create.repeatOnce' },
    { path: '/index.html', selector: '#repetir option[value=\"4\"]', key: 'dashboardPage.modals.create.repeat4' },
    { path: '/index.html', selector: '#repetir option[value=\"8\"]', key: 'dashboardPage.modals.create.repeat8' },
    { path: '/index.html', selector: '#repetir option[value=\"12\"]', key: 'dashboardPage.modals.create.repeat12' },
    { path: '/index.html', selector: '#container-cadastro .btn-acao-principal', key: 'dashboardPage.modals.create.submit' },
    { path: '/index.html', selector: '#modalEdicao h3', key: 'dashboardPage.modals.edit.title' },
    { path: '/index.html', selector: '#modalEdicao .form-edit > label:nth-of-type(1)', key: 'dashboardPage.modals.edit.labelName' },
    { path: '/index.html', selector: '#modalEdicao .form-edit > label:nth-of-type(2)', key: 'dashboardPage.modals.edit.labelWhatsapp' },
    { path: '/index.html', selector: '#edit-telefone', attr: 'placeholder', key: 'dashboardPage.modals.edit.whatsappPlaceholder' },
    { path: '/index.html', selector: '#modalEdicao .form-edit > div > div:nth-child(1) > label', key: 'dashboardPage.modals.edit.labelTotal' },
    { path: '/index.html', selector: '#modalEdicao .form-edit > div > div:nth-child(2) > label', key: 'dashboardPage.modals.edit.labelPaid' },
    { path: '/index.html', selector: '#modalEdicao .form-edit > label:nth-of-type(3)', key: 'dashboardPage.modals.edit.labelDate' },
    { path: '/index.html', selector: '#modalEdicao .btn-salvar-modal', key: 'dashboardPage.modals.edit.submit' },
    { path: '/', selector: '.dashboard .card:nth-child(1) h3', key: 'dashboardPage.cards.overdue' },
    { path: '/', selector: '.dashboard .card:nth-child(2) h3', key: 'dashboardPage.cards.remaining' },
    { path: '/', selector: '.dashboard .card:nth-child(3) h3', key: 'dashboardPage.cards.received' },
    { path: '/', selector: '#btn-abrir-cadastro .btn-text', key: 'dashboardPage.buttons.newRegister' },
    { path: '/', selector: '#buscaNome', attr: 'placeholder', key: 'dashboardPage.search.placeholder' },
    { path: '/', selector: '.tabs .tab-btn:nth-child(1)', key: 'dashboardPage.tabs.all' },
    { path: '/', selector: '.tabs .tab-btn:nth-child(2)', key: 'dashboardPage.tabs.overdue' },
    { path: '/', selector: '.tabs .tab-btn:nth-child(3)', key: 'dashboardPage.tabs.pending' },
    { path: '/', selector: '.tabs .tab-btn:nth-child(4)', key: 'dashboardPage.tabs.paid' },
    { path: '/', selector: '.tabs .tab-btn:nth-child(5)', key: 'dashboardPage.tabs.installment' },
    { path: '/', selector: '#btn-notificacoes-hoje', attr: 'aria-label', key: 'dashboardPage.notifications.openAria' },
    { path: '/', selector: '#notificacoes-hoje-titulo', key: 'dashboardPage.notifications.titleToday' },
    { path: '/', selector: '#btn-notificacoes-hoje-alternar', attr: 'aria-label', key: 'dashboardPage.notifications.toggleViewOverdue' },
    { path: '/', selector: '#btn-notificacoes-hoje-alternar', attr: 'title', key: 'dashboardPage.notifications.toggleViewOverdue' },
    { path: '/', selector: '#whats-titulo', key: 'dashboardPage.modals.whatsapp.sendMessageTitle' },
    { path: '/', selector: '#container-cadastro h3', key: 'dashboardPage.modals.create.title' },
    { path: '/', selector: '#nome', attr: 'placeholder', key: 'dashboardPage.modals.create.namePlaceholder' },
    { path: '/', selector: '#telefone', attr: 'placeholder', key: 'dashboardPage.modals.create.whatsappPlaceholder' },
    { path: '/', selector: '#valor', attr: 'placeholder', key: 'dashboardPage.modals.create.totalValuePlaceholder' },
    { path: '/', selector: '#repetir option[value=\"1\"]', key: 'dashboardPage.modals.create.repeatOnce' },
    { path: '/', selector: '#repetir option[value=\"4\"]', key: 'dashboardPage.modals.create.repeat4' },
    { path: '/', selector: '#repetir option[value=\"8\"]', key: 'dashboardPage.modals.create.repeat8' },
    { path: '/', selector: '#repetir option[value=\"12\"]', key: 'dashboardPage.modals.create.repeat12' },
    { path: '/', selector: '#container-cadastro .btn-acao-principal', key: 'dashboardPage.modals.create.submit' },
    { path: '/', selector: '#modalEdicao h3', key: 'dashboardPage.modals.edit.title' },
    { path: '/', selector: '#modalEdicao .form-edit > label:nth-of-type(1)', key: 'dashboardPage.modals.edit.labelName' },
    { path: '/', selector: '#modalEdicao .form-edit > label:nth-of-type(2)', key: 'dashboardPage.modals.edit.labelWhatsapp' },
    { path: '/', selector: '#edit-telefone', attr: 'placeholder', key: 'dashboardPage.modals.edit.whatsappPlaceholder' },
    { path: '/', selector: '#modalEdicao .form-edit > div > div:nth-child(1) > label', key: 'dashboardPage.modals.edit.labelTotal' },
    { path: '/', selector: '#modalEdicao .form-edit > div > div:nth-child(2) > label', key: 'dashboardPage.modals.edit.labelPaid' },
    { path: '/', selector: '#modalEdicao .form-edit > label:nth-of-type(3)', key: 'dashboardPage.modals.edit.labelDate' },
    { path: '/', selector: '#modalEdicao .btn-salvar-modal', key: 'dashboardPage.modals.edit.submit' },
    { path: '/economias.html', selector: '.titulo-economias', key: 'economias.pageTitle' },
    { path: '/economias.html', selector: '.subtitulo-economias', key: 'economias.subtitle' },
    { path: '/economias.html', selector: '.tabs-eco-container .tab-eco:nth-child(1)', key: 'economias.tabs.wallet' },
    { path: '/economias.html', selector: '.tabs-eco-container .tab-eco:nth-child(2)', key: 'economias.tabs.savings' },
    { path: '/economias.html', selector: '#desc-operacao', attr: 'placeholder', key: 'economias.forms.walletDescriptionPlaceholder' },
    { path: '/economias.html', selector: '#desc-poupanca', attr: 'placeholder', key: 'economias.forms.savingsDescriptionPlaceholder' },
    { path: '/economias.html', selector: '#extrato-carteira-toolbar .titulo-extrato', key: 'economias.extrato.walletTitle' },
    { path: '/economias.html', selector: '.filtro-forma-pagamento-wrap > span', key: 'economias.extrato.filterLabel' },
    { path: '/economias.html', selector: '#filtro-forma-pagamento-extrato', attr: 'aria-label', key: 'economias.extrato.filterAria' },
    { path: '/economias.html', selector: '#aba-poupanca > .titulo-extrato', key: 'economias.extrato.savingsTitle' },
    { selector: '.btn-menu-app span', key: 'common.menuPage' },
    { selector: '.btn-menu-app', attr: 'aria-label', key: 'common.openAppMenu' },
    { path: '/comercio.html', selector: '#btn-comercio-abrir-menu span', key: 'common.menuPage' },
    { path: '/comercio.html', selector: '#btn-comercio-abrir-menu', attr: 'aria-label', key: 'common.openAppMenu' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-cards .card:nth-child(1) h3', key: 'resumoEconomias.cards.totalReceived12m' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-cards .card:nth-child(2) h3', key: 'resumoEconomias.cards.totalExpenses12m' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-cards .card:nth-child(3) h3', key: 'resumoEconomias.cards.currentWallet' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-cards .card:nth-child(4) h3', key: 'resumoEconomias.cards.currentSavings' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-grafico-wrap .resumo-economias-grafico-titulo', key: 'resumoEconomias.chart.title' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-tabela thead th:nth-child(1)', key: 'resumoEconomias.table.headers.month' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-tabela thead th:nth-child(2)', key: 'resumoEconomias.table.headers.available' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-tabela thead th:nth-child(3)', key: 'resumoEconomias.table.headers.savings' },
    { path: '/resumo-economias.html', selector: '.resumo-economias-tabela thead th:nth-child(4)', key: 'resumoEconomias.table.headers.savingsAccum' },
    { path: '/resumo-economias.html', selector: '.resumo-eco-metodos-topo .resumo-economias-grafico-titulo', key: 'resumoEconomias.methods.title' },
    { path: '/resumo-economias.html', selector: '.resumo-eco-metodos-subtitulo', key: 'resumoEconomias.methods.subtitle' },
    { path: '/resumo-economias.html', selector: '.resumo-eco-metodos-filtro > span', key: 'resumoEconomias.methods.selectLabel' },
    { path: '/resumo-economias.html', selector: '#resumo-eco-forma-select', attr: 'aria-label', key: 'resumoEconomias.methods.selectAria' },
    { path: '/resumo-economias.html', selector: '#resumo-eco-metodo-coluna', key: 'resumoEconomias.methods.receivedInMethod' },

    { path: '/despesas.html', selector: '.notificacoes-header strong', key: 'despesas.notifications.alerts' },
    { path: '/despesas.html', selector: '.titulo-despesas', key: 'despesas.mainTitle' },
    { path: '/despesas.html', selector: '.subtitulo-despesas', key: 'despesas.subtitle' },
    { path: '/despesas.html', selector: '.dashboard-despesas .card:nth-child(1) h3', key: 'despesas.cards.toPay' },
    { path: '/despesas.html', selector: '.dashboard-despesas .card:nth-child(2) h3', key: 'despesas.cards.paid' },
    { path: '/despesas.html', selector: '.dashboard-despesas .card:nth-child(3) h3', key: 'despesas.cards.total' },
    { path: '/despesas.html', selector: '#btn-abrir-cadastro .btn-text', key: 'despesas.buttons.newExpense' },
    { path: '/despesas.html', selector: '.tabs-despesas .tab-btn:nth-child(1)', key: 'despesas.tabs.all' },
    { path: '/despesas.html', selector: '.tabs-despesas .tab-btn:nth-child(2)', key: 'despesas.tabs.pending' },
    { path: '/despesas.html', selector: '.tabs-despesas .tab-btn:nth-child(3)', key: 'despesas.tabs.paid' },
    { path: '/despesas.html', selector: '.tabs-despesas .tab-btn:nth-child(4)', key: 'despesas.tabs.overdue' },
    { path: '/despesas.html', selector: '#nomeDespesa', attr: 'placeholder', key: 'despesas.modal.namePlaceholder' },
    { path: '/despesas.html', selector: '#valorDespesa', attr: 'placeholder', key: 'despesas.modal.valuePlaceholder' },
    { path: '/despesas.html', selector: '#statusDespesa option[value=\"pendente\"]', key: 'despesas.modal.statusPending' },
    { path: '/despesas.html', selector: '#statusDespesa option[value=\"pago\"]', key: 'despesas.modal.statusPaid' },
    { path: '/despesas.html', selector: '#recorrente-despesa-label-texto', key: 'despesas.modal.recurringMonthly' },
    { path: '/despesas.html', selector: '#modalDespesa .btn-acao-principal', key: 'despesas.buttons.save' }
  ];

  global.__FIN_I18N_EXTRA_MESSAGES = deepMerge(global.__FIN_I18N_EXTRA_MESSAGES || {}, extraMessages);
  global.__FIN_I18N_EXTRA_SELECTOR_MAP = (global.__FIN_I18N_EXTRA_SELECTOR_MAP || []).concat(extraSelectorMap);
})(window);
