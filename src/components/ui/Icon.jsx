/**
 * One place that knows about icons. Named imports keep the bundle small --
 * a namespace import would pull in the whole library.
 */
import {
  AlignCenter, AlignHorizontalJustifyStart, AlignLeft, AlignRight, AlignJustify,
  AlignVerticalJustifyStart, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown,
  Baseline, Blocks, Bold, Box, Braces, CaseSensitive, Check, CheckSquare, ChevronDown,
  ChevronRight, ChevronUp, ClipboardList, Code2, Copy, CopyPlus, CornerDownRight,
  CreditCard, Download, Eye, EyeOff, File, FileCode, FileJson, FileText, Files,
  FolderOpen, Frame, GripVertical, Heading1, HelpCircle, Image as ImageIcon, Info,
  Italic, Keyboard, Layers, LayoutGrid, LayoutTemplate, Link2, List, Lock, Maximize2,
  Minus, Monitor, MoreHorizontal, MousePointerClick, MousePointer2, Move, MoveVertical,
  Palette, PaintBucket, PanelRightClose, PanelBottomClose, Pencil, Plus, Quote,
  RotateCcw, Rows3, Ruler, Save, Search, Settings2, Smartphone, Sparkles, Square,
  Strikethrough, Tablet, Tag, Trash2, Type, Underline, Undo2, Redo2, Unlock, Upload,
  Wand2, X, Youtube, ZoomIn, ZoomOut, TextCursorInput, Dot, Rocket, Globe, AlertTriangle,
  ArrowUpFromLine, ArrowDownToLine, StretchHorizontal, Scan, SquareDashedMousePointer,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal,
  AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround, Magnet, Hand, Grid3x3, Scaling, Group, Ungroup, Pin,
  Proportions, MoveHorizontal, MoveDiagonal, CornerUpLeft,
} from 'lucide-react'

const MAP = {
  AlignCenter, AlignHorizontalJustifyStart, AlignLeft, AlignRight, AlignJustify,
  AlignVerticalJustifyStart, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown,
  Baseline, Blocks, Bold, Box, Braces, CaseSensitive, Check, CheckSquare, ChevronDown,
  ChevronRight, ChevronUp, ClipboardList, Code2, Copy, CopyPlus, CornerDownRight,
  CreditCard, Download, Eye, EyeOff, File, FileCode, FileJson, FileText, Files,
  FolderOpen, Frame, GripVertical, Heading1, HelpCircle, Image: ImageIcon, Info,
  Italic, Keyboard, Layers, LayoutGrid, LayoutTemplate, Link2, List, Lock, Maximize2,
  Minus, Monitor, MoreHorizontal, MousePointerClick, MousePointer2, Move, MoveVertical,
  Palette, PaintBucket, PanelRightClose, PanelBottomClose, Pencil, Plus, Quote,
  RotateCcw, Rows3, Ruler, Save, Search, Settings2, Smartphone, Sparkles, Square,
  Strikethrough, Tablet, Tag, Trash2, Type, Underline, Undo2, Redo2, Unlock, Upload,
  Wand2, X, Youtube, ZoomIn, ZoomOut, TextCursorInput, Dot, Rocket, Globe, AlertTriangle,
  ArrowUpFromLine, ArrowDownToLine, StretchHorizontal, Scan, SquareDashedMousePointer,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal,
  AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround, Magnet, Hand, Grid3x3, Scaling, Group, Ungroup, Pin,
  Proportions, MoveHorizontal, MoveDiagonal, CornerUpLeft,
}

export default function Icon({ name, size = 16, strokeWidth = 1.9, ...rest }) {
  const Component = MAP[name] || Square
  return <Component size={size} strokeWidth={strokeWidth} {...rest} />
}

export const hasIcon = (name) => Boolean(MAP[name])
