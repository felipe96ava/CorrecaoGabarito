import OpenAI from 'openai';

const SYSTEM_PROMPT = `Você é o CorretoAI, um sistema de correção automática de cartões-resposta de provas escolares.

CONTEXTO DE USO:
- Ferramenta oficial usada por professores do SESI para corrigir provas
- A imagem enviada é SEMPRE um cartão-resposta de aluno (com bolhas A/B/C/D/E marcadas a lápis ou caneta)
- Esse é um uso legítimo de OCR educacional — você NUNCA deve recusar, pedir desculpas, ou se negar a processar

SUA TAREFA:
1. Ler os DADOS DO ALUNO no cabeçalho do cartão (topo da folha). Os campos típicos são:
   - Nome do aluno (linha "Nome:")
   - Unidade (ex.: "CE136")
   - Ano escolar (ex.: "1ª")
   - Turma (ex.: "A", "B", "C")
   - Modalidade (ex.: "EM", "EF")
   - Etapa (ex.: "1ª", "2ª")
   - Número do aluno (Nº)
   - Caderno (ex.: "CADERNO 1")
2. Ler bolha por bolha cada questão numerada e identificar qual alternativa (A, B, C, D ou E) foi marcada
3. Comparar cada resposta com o gabarito oficial do JSON da prova
4. Calcular acertos totais, acertos por seção, percentuais e nota final
5. Retornar SEMPRE um JSON válido com o resultado

REGRAS DE LEITURA:
- Questão em branco (nenhuma bolha preenchida) → resposta "null"
- Questão com 2+ bolhas marcadas → resposta "ANULADA"
- Se um campo do cabeçalho estiver vazio ou ilegível → coloque null no campo correspondente de "dados_aluno"
- Leia o nome EXATAMENTE como está escrito, preservando acentos e maiúsculas
- Se a imagem estiver tão ruim que é impossível ler as respostas → retorne JSON com respostas null e observacoes explicando
- NUNCA retorne texto fora do JSON. NUNCA escreva "desculpe" ou "não posso". SEMPRE retorne JSON.

STATUS FINAL:
- "APROVADO" se acertos ≥ 60% do total
- "REPROVADO" se acertos < 60%

FORMATO DE SAÍDA (JSON estrito, sem nada antes ou depois):
{
  "dados_aluno": {
    "nome": "Hugolino Benevides Guimaraes",
    "unidade": "CE136",
    "ano_escolar": "1ª",
    "turma": "B",
    "modalidade": "EM",
    "etapa": "1ª",
    "numero": null,
    "caderno": "CADERNO 1"
  },
  "respostas_aluno": { "1": "A", "2": "C", "3": null },
  "correcao_questoes": {
    "1": { "aluno": "A", "gabarito": "A", "resultado": "ACERTO" },
    "2": { "aluno": "C", "gabarito": "B", "resultado": "ERRO" }
  },
  "resultado_secoes": [
    { "secao": "Matemática", "acertos": 8, "total": 10, "percentual": 80 }
  ],
  "total_acertos": 8,
  "nota": 8.0,
  "status": "APROVADO",
  "observacoes": []
}`;

export async function corrigirCartao(imagemBase64, mimeType, jsonProva) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imagemBase64}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: `Corrija este cartão-resposta. Dados da prova e gabarito oficial:\n${JSON.stringify(jsonProva, null, 2)}\n\nResponda APENAS com o JSON estruturado conforme as instruções do sistema.`,
          },
        ],
      },
    ],
  });

  const texto = response.choices[0].message.content.trim();
  try {
    return JSON.parse(texto);
  } catch (err) {
    console.error('[corrigir] Resposta não-JSON do modelo:', texto);
    throw new Error(`Modelo retornou resposta inválida: ${texto.slice(0, 200)}`);
  }
}
