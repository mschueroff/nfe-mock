// Adapted from @brasil-fiscal/nfe 2.0.7. See LICENSE and README.md.
import { XmlBuilder } from '@brasil-fiscal/nfe';
import { NFeProps } from '@brasil-fiscal/nfe';
import { EmitenteProps } from '@brasil-fiscal/nfe';
import { DestinatarioProps } from '@brasil-fiscal/nfe';
import { EnderecoProps } from '@brasil-fiscal/nfe';
import { ProdutoProps } from '@brasil-fiscal/nfe';
import { TransporteProps } from '@brasil-fiscal/nfe';
import { PagamentoProps } from '@brasil-fiscal/nfe';
import { CobrancaProps } from '@brasil-fiscal/nfe';
import { UF_CODES } from '../../../shared/contracts';
import type { FiscalDocument } from '../document';
import { buildFiscalIde, buildFiscalItems, buildFiscalTotals } from '../xml-fragments';
import { tag, tagGroup, formatNumber, formatDate } from '@brasil-fiscal/core';

const NFE_VERSION = '4.00';
const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe';

export class DefaultXmlBuilder {
  build(nfe: NFeProps, fiscal: FiscalDocument): string {
    const uf = nfe.identificacao.uf;
    const cUF = UF_CODES[uf] || uf;
    const dataEmissao = nfe.identificacao.dataEmissao ?? new Date();
    const tipoEmissao = nfe.identificacao.tipoEmissao ?? 1;
    const codigoNumerico = fiscal.numericCode;
    const modelo = nfe.identificacao.modelo ?? '55';

    const chaveAcesso = fiscal.accessKey;

    const cDV = chaveAcesso.slice(-1);

    const ide = buildFiscalIde(fiscal);
    const emit = this.buildEmitente(nfe.emitente, fiscal.emitter.cpf);
    const ambiente = (nfe.identificacao.ambiente ?? 2) as 1 | 2;
    const dest = this.buildDestinatario(nfe.destinatario, ambiente);
    const det = buildFiscalItems(fiscal);
    const total = buildFiscalTotals(fiscal);
    const transp = this.buildTransporte(nfe.transporte);
    const cobr = this.buildCobranca(nfe.cobranca);
    const pag = this.buildPagamento(nfe.pagamento);
    const infAdic = this.buildInformacoesAdicionais(
      nfe.informacoesComplementares,
      nfe.informacoesFisco,
    );

    const infNFe =
      `<infNFe versao="${NFE_VERSION}" Id="NFe${chaveAcesso}">` +
      ide +
      emit +
      dest +
      det +
      total +
      transp +
      cobr +
      pag +
      infAdic +
      '</infNFe>';

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<NFe xmlns="${NFE_NAMESPACE}">` +
      infNFe +
      '</NFe>'
    );
  }

  private buildEmitente(emit: EmitenteProps, cpf?: string): string {
    const endereco = this.buildEndereco('enderEmit', emit.endereco);

    return tagGroup(
      'emit',
      (cpf ? tag('CPF', cpf) : tag('CNPJ', emit.cnpj)) +
        tag('xNome', emit.razaoSocial) +
        tag('xFant', emit.nomeFantasia) +
        endereco +
        tag('IE', emit.inscricaoEstadual) +
        tag('IM', emit.inscricaoMunicipal) +
        tag('CNAE', emit.cnae) +
        tag('CRT', String(emit.regimeTributario)),
    );
  }

  private buildDestinatario(dest: DestinatarioProps | undefined, tpAmb: 1 | 2): string {
    if (!dest) return '';
    const doc = dest.cnpj ? tag('CNPJ', dest.cnpj) : dest.cpf ? tag('CPF', dest.cpf) : '';
    if (!doc) return '';
    const endereco = dest.endereco ? this.buildEndereco('enderDest', dest.endereco) : '';
    const xNome =
      tpAmb === 2 ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : dest.nome;

    return tagGroup(
      'dest',
      doc +
        tag('xNome', xNome) +
        endereco +
        tag('indIEDest', String(dest.indicadorIE)) +
        tag('IE', dest.inscricaoEstadual) +
        tag('email', dest.email),
    );
  }

  private buildEndereco(tagName: string, end: EnderecoProps): string {
    return tagGroup(
      tagName,
      tag('xLgr', end.logradouro) +
        tag('nro', end.numero) +
        tag('xCpl', end.complemento) +
        tag('xBairro', end.bairro) +
        tag('cMun', end.codigoMunicipio) +
        tag('xMun', end.municipio) +
        tag('UF', end.uf) +
        tag('CEP', end.cep) +
        tag('cPais', end.codigoPais || '1058') +
        tag('xPais', end.pais || 'Brasil') +
        tag('fone', end.telefone),
    );
  }

  private buildTransporte(transp: TransporteProps): string {
    let transportadora = '';
    if (transp.cnpjTransportadora || transp.nomeTransportadora) {
      transportadora = tagGroup(
        'transporta',
        tag(transp.cnpjTransportadora?.length === 11 ? 'CPF' : 'CNPJ', transp.cnpjTransportadora) +
          tag('xNome', transp.nomeTransportadora) +
          tag('IE', transp.inscricaoEstadual) +
          tag('xEnder', transp.endereco) +
          tag('xMun', transp.municipio) +
          tag('UF', transp.uf),
      );
    }

    let volumes = '';
    if (transp.volumes) {
      volumes = transp.volumes
        .map((vol) =>
          tagGroup(
            'vol',
            tag('qVol', vol.quantidade !== undefined ? String(vol.quantidade) : undefined) +
              tag('esp', vol.especie) +
              tag('marca', vol.marca) +
              tag('nVol', vol.numeracao) +
              tag(
                'pesoL',
                vol.pesoLiquido !== undefined ? formatNumber(vol.pesoLiquido, 3) : undefined,
              ) +
              tag(
                'pesoB',
                vol.pesoBruto !== undefined ? formatNumber(vol.pesoBruto, 3) : undefined,
              ),
          ),
        )
        .join('');
    }

    let veiculo = '';
    if (transp.veiculo) {
      veiculo = tagGroup(
        'veicTransp',
        tag('placa', transp.veiculo.placa) +
          tag('UF', transp.veiculo.uf) +
          tag('RNTC', transp.veiculo.rntc),
      );
    }

    return tagGroup(
      'transp',
      tag('modFrete', String(transp.modalidadeFrete)) + transportadora + veiculo + volumes,
    );
  }

  private buildCobranca(cobr?: CobrancaProps): string {
    if (!cobr) return '';

    let fat = '';
    if (cobr.fatura) {
      fat = tagGroup(
        'fat',
        tag('nFat', cobr.fatura.nFat) +
          tag(
            'vOrig',
            cobr.fatura.vOrig !== undefined ? formatNumber(cobr.fatura.vOrig, 2) : undefined,
          ) +
          tag(
            'vDesc',
            cobr.fatura.vDesc !== undefined ? formatNumber(cobr.fatura.vDesc, 2) : undefined,
          ) +
          tag(
            'vLiq',
            cobr.fatura.vLiq !== undefined ? formatNumber(cobr.fatura.vLiq, 2) : undefined,
          ),
      );
    }

    let dups = '';
    if (cobr.duplicatas) {
      dups = cobr.duplicatas
        .map((dup) =>
          tagGroup(
            'dup',
            tag('nDup', dup.nDup) +
              tag('dVenc', dup.dVenc) +
              tag('vDup', formatNumber(dup.vDup, 2)),
          ),
        )
        .join('');
    }

    return tagGroup('cobr', fat + dups);
  }

  private buildPagamento(pag: PagamentoProps): string {
    const detPag = pag.pagamentos
      .map((p) => {
        let content = tag('tPag', p.formaPagamento) + tag('vPag', formatNumber(p.valor, 2));

        if (p.tipoIntegracao !== undefined) {
          let cardContent = tag('tpIntegra', String(p.tipoIntegracao));
          if (p.cnpjCredenciadora) cardContent += tag('CNPJ', p.cnpjCredenciadora);
          if (p.bandeira) cardContent += tag('tBand', p.bandeira);
          if (p.autorizacao) cardContent += tag('cAut', p.autorizacao);
          content += tagGroup('card', cardContent);
        }

        return tagGroup('detPag', content);
      })
      .join('');

    let troco = '';
    if (pag.troco && pag.troco > 0) {
      troco = tag('vTroco', formatNumber(pag.troco, 2));
    }

    return tagGroup('pag', detPag + troco);
  }

  private buildInformacoesAdicionais(complementar?: string, fisco?: string): string {
    if (!complementar && !fisco) return '';

    return tagGroup('infAdic', tag('infAdFisco', fisco) + tag('infCpl', complementar));
  }
}
