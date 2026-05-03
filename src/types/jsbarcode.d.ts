// Declaração de tipo para jsbarcode
declare module 'jsbarcode' {
    interface Options {
        format?: string;
        width?: number;
        height?: number;
        displayValue?: boolean;
        text?: string;
        fontOptions?: string;
        font?: string;
        textAlign?: string;
        textPosition?: string;
        textMargin?: number;
        fontSize?: number;
        background?: string;
        lineColor?: string;
        margin?: number;
        marginTop?: number;
        marginBottom?: number;
        marginLeft?: number;
        marginRight?: number;
        valid?: (valid: boolean) => void;
    }

    function JsBarcode(
        element: HTMLCanvasElement | HTMLImageElement | SVGElement | string,
        text: string,
        options?: Options
    ): void;

    export = JsBarcode;
    export default JsBarcode;
}
