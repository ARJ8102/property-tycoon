import type {PropertyGroup,PurchasableSpace} from '@property-tycoon/shared';
/** Display palette only; property groups, economics and server rules stay unchanged. */
export const GROUP_COLORS:Record<PropertyGroup,string>={clay:'#995C40',sky:'#49B8E8',rose:'#E46AA5',amber:'#F29A38',coral:'#E85B56',gold:'#E5C547',jade:'#43A77A',indigo:'#5278D5'};
export const collectionColor=(p:PurchasableSpace)=>p.kind==='property'?GROUP_COLORS[p.group]:p.kind==='transit'?'#487FA5':'#36896C';
